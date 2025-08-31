import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { IPlugin, PluginRoute, ApiResponse } from '@/types'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'

const execAsync = promisify(exec)

// 磁盘信息接口
interface DiskInfo {
  mount: string
  total: number
  used: number
  available: number
  usePercent: number
}

// 磁盘空间服务
class DiskSpaceService {
  /**
   * 获取磁盘空间信息
   */
  async getDiskSpace(): Promise<DiskInfo[]> {
    try {
      const platform = os.platform()

      if (platform === 'win32') {
        return await this.getWindowsDiskSpace()
      } else if (platform === 'linux' || platform === 'darwin') {
        return await this.getUnixDiskSpace()
      } else {
        throw new Error(`Unsupported platform: ${platform}`)
      }
    } catch (error) {
      console.error('Failed to get disk space:', error)
      throw error
    }
  }

  /**
   * 获取Windows磁盘空间信息
   */
  private async getWindowsDiskSpace(): Promise<DiskInfo[]> {
    try {
      // 使用wmic命令获取Windows磁盘信息
      const { stdout } = await execAsync('wmic logicaldisk get deviceid,size,freespace /format:csv')

      const lines = stdout.trim().split('\n').filter(line => line.trim())
      if (lines.length < 2) return []

      const disks: DiskInfo[] = []

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',')
        if (parts.length >= 4) {
          const deviceId = parts[1]
          const freeSpace = parseInt(parts[2]) || 0
          const totalSize = parseInt(parts[3]) || 0
          const used = totalSize - freeSpace

          if (totalSize > 0) {
            disks.push({
              mount: deviceId,
              total: totalSize,
              used: used,
              available: freeSpace,
              usePercent: Math.round((used / totalSize) * 100)
            })
          }
        }
      }

      return disks
    } catch (error) {
      console.error('Failed to get Windows disk space:', error)
      return []
    }
  }

  /**
   * 获取Unix-like系统磁盘空间信息
   */
  private async getUnixDiskSpace(): Promise<DiskInfo[]> {
    try {
      // 检测操作系统类型
      const platform = os.platform()

      let dfCommand: string
      if (platform === 'darwin') {
        // macOS
        dfCommand = 'df -k'
      } else {
        // Linux
        dfCommand = 'df -B1'
      }

      // 使用df命令获取磁盘信息
      const { stdout } = await execAsync(dfCommand)

      const lines = stdout.trim().split('\n').filter(line => line.trim())
      if (lines.length < 2) return []

      const disks: DiskInfo[] = []

      // 跳过标题行
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/)
        if (parts.length >= 6) {
          const mount = parts[parts.length - 1] // 挂载点通常是最后一列
          let total: number
          let used: number
          let available: number
          let usePercent: number

          if (platform === 'darwin') {
            // macOS: Filesystem 1024-blocks Used Available Capacity Mounted on
            total = parseInt(parts[1]) * 1024 || 0 // 转换为字节
            used = parseInt(parts[2]) * 1024 || 0
            available = parseInt(parts[3]) * 1024 || 0
            usePercent = parseInt(parts[4].replace('%', '')) || 0
          } else {
            // Linux: Filesystem 1B-blocks Used Available Use% Mounted on
            total = parseInt(parts[1]) || 0
            used = parseInt(parts[2]) || 0
            available = parseInt(parts[3]) || 0
            usePercent = parseInt(parts[4].replace('%', '')) || 0
          }

          // 只包含真实的挂载点，排除特殊文件系统
          if (total > 0 && mount.startsWith('/') && !mount.includes('tmpfs') && !mount.includes('devfs')) {
            disks.push({
              mount,
              total,
              used,
              available,
              usePercent
            })
          }
        }
      }

      return disks
    } catch (error) {
      console.error('Failed to get Unix disk space:', error)
      return []
    }
  }

  /**
   * 获取主要磁盘信息（最大的磁盘）
   */
  async getMainDiskInfo(): Promise<DiskInfo | null> {
    const disks = await this.getDiskSpace()
    if (disks.length === 0) return null

    // 返回最大容量的磁盘
    return disks.reduce((max, current) =>
      current.total > max.total ? current : max
    )
  }

  /**
   * 格式化字节为人类可读格式
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// 磁盘空间插件实现
export class DiskSpacePlugin implements IPlugin {
  name = 'disk-space'
  version = '1.0.0'
  description = 'A plugin to monitor disk space usage'
  author = 'System'

  // 前端配置
  frontend = {
    component: 'DiskSpace',
    menu: {
      title: '磁盘空间',
      icon: 'HardDrive',
      order: 2,
      path: '/plugins/disk-space'
    }
  }

  private diskService: DiskSpaceService

  constructor() {
    this.diskService = new DiskSpaceService()
  }

  async install(app: FastifyInstance): Promise<void> {
    // 注册路由
    this.routes?.forEach(route => {
      app.route(route)
    })

    console.log('Disk space plugin installed successfully')
  }

  // 插件路由
  routes: PluginRoute[] = [
    {
      method: 'GET',
      url: '/api/disk-space',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const diskInfo = await this.diskService.getDiskSpace()

          return reply.send({
            success: true,
            data: diskInfo,
            timestamp: Date.now()
          } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({
            success: false,
            message: 'Failed to get disk space information',
            timestamp: Date.now()
          } as ApiResponse)
        }
      }
    },
    {
      method: 'GET',
      url: '/api/disk-space/main',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const mainDisk = await this.diskService.getMainDiskInfo()

          return reply.send({
            success: true,
            data: mainDisk,
            timestamp: Date.now()
          } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({
            success: false,
            message: 'Failed to get main disk information',
            timestamp: Date.now()
          } as ApiResponse)
        }
      }
    }
  ]
}

// 确保插件被正确导出
module.exports = new DiskSpacePlugin()
// 兼容ES模块导入
export default new DiskSpacePlugin()
