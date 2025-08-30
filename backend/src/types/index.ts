import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// 扩展FastifyRequest接口以包含用户属性
declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: number; username: string }
  }
}

// 插件基础接口
export interface IPlugin {
  name: string
  version: string
  description: string
  author?: string
  dependencies?: string[]
  
  // 插件生命周期
  install(app: FastifyInstance): Promise<void>
  uninstall?(app: FastifyInstance): Promise<void>
  
  // 路由配置
  routes?: PluginRoute[]
  
  // 前端配置
  frontend?: {
    component: string
    menu?: MenuConfig
    assets?: string[]
  }
}

// 路由配置
export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
  schema?: any
  preHandler?: any[]
}

// 菜单配置
export interface MenuConfig {
  title: string
  icon?: string
  order?: number
  path: string
  children?: MenuConfig[]
}

// API 响应格式
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: string
  timestamp: number
}

// 插件注册表
export interface PluginRegistry {
  [key: string]: {
    plugin: IPlugin
    installed: boolean
    enabled: boolean
    installTime: number
  }
}

// 事件系统
export interface EventPayload {
  type: string
  data?: any
  source?: string
  timestamp: number
}

export type EventHandler = (payload: EventPayload) => void | Promise<void>

// 配置接口
export interface AppConfig {
  server: {
    host: string
    port: number
    cors: boolean
  }
  database: {
    type: 'sqlite'
    path: string
  }
  plugins: {
    autoLoad: boolean
    directory: string
  }
}

// 数据库接口
export interface DatabaseAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  query(sql: string, params?: any[]): Promise<any>
  run(sql: string, params?: any[]): Promise<any>
}

// 用户信息
export interface User {
  id: number
  username: string
  password?: string
  email?: string
  createdAt: number
}