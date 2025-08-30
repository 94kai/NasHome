import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { IPlugin } from '@/types'
import { ResponseHelper } from '@/utils/response'
import { EventBus } from '@/core/EventBus'
import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * 网络状态插件
 */
class NetworkStatusPlugin implements IPlugin {
  name = 'network-status'
  version = '1.0.0'
  description = '监控和显示 NAS 网络状态信息'
  author = 'NAS Team'
  
  private eventBus: EventBus
  private monitorInterval: NodeJS.Timeout | null = null
  
  constructor() {
    this.eventBus = EventBus.getInstance()
  }
  
  async install(app: FastifyInstance): Promise<void> {
    // 注册路由
    this.routes?.forEach(route => {
      app.route({
        method: route.method,
        url: route.url,
        handler: route.handler,
        schema: route.schema
      })
    })
    
    // 启动网络监控
    await this.startNetworkMonitoring()
    
    console.log('Network Status Plugin installed')
  }
  
  async uninstall(): Promise<void> {
    // 停止监控
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }
    
    console.log('Network Status Plugin uninstalled')
  }
  
  routes = [
    {
      method: 'GET' as const,
      url: '/api/plugins/network-status/status',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const networkInfo = await this.getNetworkInfo()
          ResponseHelper.success(reply, networkInfo)
        } catch (error) {
          ResponseHelper.error(reply, 'Failed to get network status', 'NETWORK_ERROR')
        }
      },
      schema: {
        description: '获取网络状态信息',
        tags: ['NetworkStatus'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  interfaces: { type: 'array' },
                  connectivity: { type: 'object' },
                  statistics: { type: 'object' }
                }
              }
            }
          }
        }
      }
    },
    {
      method: 'GET' as const,
      url: '/api/plugins/network-status/connectivity',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const connectivity = await this.checkConnectivity()
          ResponseHelper.success(reply, connectivity)
        } catch (error) {
          ResponseHelper.error(reply, 'Failed to check connectivity', 'CONNECTIVITY_ERROR')
        }
      },
      schema: {
        description: '检查网络连通性',
        tags: ['NetworkStatus']
      }
    },
    {
      method: 'GET' as const,
      url: '/api/plugins/network-status/speed-test',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const speedTest = await this.runSpeedTest()
          ResponseHelper.success(reply, speedTest)
        } catch (error) {
          ResponseHelper.error(reply, 'Failed to run speed test', 'SPEED_TEST_ERROR')
        }
      },
      schema: {
        description: '运行网络速度测试',
        tags: ['NetworkStatus']
      }
    }
  ]
  
  frontend = {
    component: 'NetworkStatus',
    menu: {
      title: '网络状态',
      icon: 'Connection',
      order: 1,
      path: '/plugins/network-status'
    }
  }
  
  /**
   * 获取网络接口信息
   */
  private async getNetworkInfo() {
    const interfaces = os.networkInterfaces()
    const networkInfo: any = {
      interfaces: [],
      statistics: {
        totalInterfaces: 0,
        activeInterfaces: 0,
        ipv4Addresses: 0,
        ipv6Addresses: 0
      }
    }
    
    for (const [name, iface] of Object.entries(interfaces)) {
      if (!iface) continue
      
      networkInfo.statistics.totalInterfaces++
      
      const interfaceInfo = {
        name,
        addresses: iface.map(addr => ({
          address: addr.address,
          netmask: addr.netmask,
          family: addr.family,
          mac: addr.mac,
          internal: addr.internal,
          cidr: addr.cidr
        }))
      }
      
      // 统计活跃接口和地址
      const hasActiveAddress = iface.some(addr => !addr.internal)
      if (hasActiveAddress) {
        networkInfo.statistics.activeInterfaces++
      }
      
      networkInfo.statistics.ipv4Addresses += iface.filter(addr => addr.family === 'IPv4' && !addr.internal).length
      networkInfo.statistics.ipv6Addresses += iface.filter(addr => addr.family === 'IPv6' && !addr.internal).length
      
      networkInfo.interfaces.push(interfaceInfo)
    }
    
    return networkInfo
  }
  
  /**
   * 检查网络连通性
   */
  private async checkConnectivity() {
    const targets = [
      { name: 'Google DNS', host: '8.8.8.8' },
      { name: 'Cloudflare DNS', host: '1.1.1.1' },
      { name: 'Baidu', host: 'baidu.com' }
    ]
    
    const results = await Promise.allSettled(
      targets.map(async target => {
        try {
          const startTime = Date.now()
          await execAsync(`ping -c 1 -W 3 ${target.host}`)
          const endTime = Date.now()
          
          return {
            name: target.name,
            host: target.host,
            status: 'success',
            latency: endTime - startTime,
            error: null
          }
        } catch (error) {
          return {
            name: target.name,
            host: target.host,
            status: 'failed',
            latency: null,
            error: (error as Error).message
          }
        }
      })
    )
    
    return {
      timestamp: Date.now(),
      results: results.map(result => 
        result.status === 'fulfilled' ? result.value : {
          name: 'Unknown',
          host: 'Unknown',
          status: 'failed',
          latency: null,
          error: 'Promise rejected'
        }
      )
    }
  }
  
  /**
   * 运行网络速度测试（模拟）
   */
  private async runSpeedTest() {
    // 这里是一个模拟的速度测试
    // 在实际应用中，你可以集成真实的速度测试工具
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          timestamp: Date.now(),
          download: Math.random() * 100 + 50, // 模拟下载速度 50-150 Mbps
          upload: Math.random() * 50 + 20,    // 模拟上传速度 20-70 Mbps
          ping: Math.random() * 50 + 10,      // 模拟延迟 10-60 ms
          jitter: Math.random() * 10 + 1      // 模拟抖动 1-11 ms
        })
      }, 3000) // 模拟测试需要 3 秒
    })
  }
  
  /**
   * 启动网络监控
   */
  private async startNetworkMonitoring() {
    // 每30秒检查一次网络状态
    this.monitorInterval = setInterval(async () => {
      try {
        const connectivity = await this.checkConnectivity()
        const hasConnectivity = connectivity.results.some(result => result.status === 'success')
        
        // 发布网络状态事件
        await this.eventBus.emit('network:status', {
          connected: hasConnectivity,
          timestamp: Date.now()
        }, 'NetworkStatusPlugin')
        
      } catch (error) {
        console.error('Network monitoring error:', error)
      }
    }, 30000)
  }
}

export default new NetworkStatusPlugin()