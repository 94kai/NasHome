import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import staticFiles from '@fastify/static'
import websocket from '@fastify/websocket'
import * as path from 'path'

import { config, ensureDataDir } from '@/utils/config'
import { SQLiteAdapter } from '@/core/Database'
import { PluginManager } from '@/core/PluginManager'
import { EventBus } from '@/core/EventBus'
import { ResponseHelper } from '@/utils/response'
import userRoutes from './routes/user'

/**
 * 创建 Fastify 应用实例
 */
async function createApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    }
  })

  // 注册 CORS
  if (config.server.cors) {
    await app.register(cors, {
      origin: true,
      credentials: true
    })
  }

  // 注册 Swagger 文档
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'NAS Service API',
        description: 'NAS 服务脚手架 API 文档',
        version: '1.0.0'
      },
      servers: [
        {
          url: `http://localhost:${config.server.port}`,
          description: 'Development server'
        }
      ]
    }
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    }
  })

  // 注册 WebSocket 支持
  await app.register(websocket)

  // 静态文件服务（用于前端资源）
  const frontendDir = path.join(process.cwd(), '..', 'frontend', 'dist')
  try {
    await app.register(staticFiles, {
      root: frontendDir,
      prefix: '/'
    })
    console.log(`Serving static files from: ${frontendDir}`)
  } catch (error) {
    console.warn('Frontend build not found, serving API only')
  }

  return app
}

/**
 * 注册核心路由
 */
function registerCoreRoutes(app: FastifyInstance, pluginManager: PluginManager, eventBus: EventBus) {
  // 健康检查
  app.get('/api/health', {
    schema: {
      description: '健康检查',
      tags: ['System'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                timestamp: { type: 'number' },
                uptime: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    ResponseHelper.success(reply, {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime()
    })
  })

  // 获取系统信息
  app.get('/api/system/info', {
    schema: {
      description: '获取系统信息',
      tags: ['System']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    ResponseHelper.success(reply, {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    })
  })

  // 插件管理路由
  app.get('/api/plugins', {
    schema: {
      description: '获取所有插件',
      tags: ['Plugins']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const plugins = pluginManager.getPlugins()
    ResponseHelper.success(reply, plugins)
  })

  app.get('/api/plugins/menus', {
    schema: {
      description: '获取插件菜单配置',
      tags: ['Plugins']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const menus = pluginManager.getPluginMenus()
    ResponseHelper.success(reply, menus)
  })

  app.post('/api/plugins/:name/toggle', {
    schema: {
      description: '启用/禁用插件',
      tags: ['Plugins'],
      params: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      },
      body: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' }
        },
        required: ['enabled']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name } = request.params as { name: string }
      const { enabled } = request.body as { enabled: boolean }
      
      await pluginManager.togglePlugin(name, enabled)
      ResponseHelper.success(reply, null, `Plugin ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      ResponseHelper.error(reply, (error as Error).message)
    }
  })

  // 事件系统路由
  app.get('/api/events/types', {
    schema: {
      description: '获取所有事件类型',
      tags: ['Events']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const eventTypes = eventBus.getEventTypes()
    ResponseHelper.success(reply, eventTypes)
  })

  // WebSocket 支持 (用于实时事件推送)
  app.get('/api/ws', { websocket: true }, (connection, req) => {
    connection.socket.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString())
        console.log('WebSocket message:', data)
      } catch (error) {
        console.error('WebSocket message parse error:', error)
      }
    })

    // 订阅系统事件并推送给客户端
    const handleEvent = (payload: any) => {
      connection.socket.send(JSON.stringify({
        type: 'event',
        payload
      }))
    }

    eventBus.on('*', handleEvent)
    
    connection.socket.on('close', () => {
      eventBus.off('*', handleEvent)
    })
  })
}

/**
 * 启动应用
 */
async function start() {
  try {
    console.log('Starting NAS Service...')
    
    // 确保数据目录存在
    await ensureDataDir()
    
    // 创建应用实例
    const app = await createApp()
    
    // 初始化数据库
    const db = new SQLiteAdapter(config.database.path)
    await db.connect()
    await db.initTables()
    
    // 创建插件管理器
    const pluginManager = new PluginManager(app, db, config.plugins.directory)
    const eventBus = EventBus.getInstance()
    
    // 注册核心路由
    registerCoreRoutes(app, pluginManager, eventBus)
    
    // 注册用户路由
    await app.register(userRoutes, { prefix: '/api' })
    
    // 加载和安装插件
    if (config.plugins.autoLoad) {
      await pluginManager.loadPlugins()
      await pluginManager.autoInstall()
    }
    
    // 启动服务器
    await app.listen({
      host: config.server.host,
      port: config.server.port
    })
    
    console.log(`🚀 Server started at http://${config.server.host}:${config.server.port}`)
    console.log(`📚 API docs available at http://${config.server.host}:${config.server.port}/docs`)
    
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...')
  process.exit(0)
})

// 启动应用
start()