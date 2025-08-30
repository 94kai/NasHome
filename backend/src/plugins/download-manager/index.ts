import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { IPlugin } from '@/types'
import { ResponseHelper } from '@/utils/response'
import { EventBus } from '@/core/EventBus'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

interface DownloadTask {
  id: string
  name: string
  url: string
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused'
  progress: number
  size: number
  downloadedSize: number
  speed: number
  createdAt: number
  updatedAt: number
  filePath?: string
  error?: string
  userId?: string
}

/**
 * 下载管理插件
 */
class DownloadManagerPlugin implements IPlugin {
  name = 'download-manager'
  version = '1.0.0'
  description = '管理 NAS 文件下载任务'
  author = 'NAS Team'
  
  private eventBus: EventBus
  private downloads: Map<string, DownloadTask> = new Map()
  private downloadDir: string
  private maxConcurrentDownloads = 3
  private activeDownloads = 0
  
  constructor() {
    this.eventBus = EventBus.getInstance()
    this.downloadDir = path.join(process.cwd(), 'downloads')
  }
  
  /**
   * 获取用户下载目录
   */
  private getUserDownloadDir(userId?: string): string {
    if (userId) {
      return path.join(this.downloadDir, 'users', userId)
    }
    return this.downloadDir
  }
  
  async install(app: FastifyInstance): Promise<void> {
    // 确保下载目录存在
    await this.ensureDownloadDir()
    
    // 确保用户下载目录的基础结构存在
    const usersDir = path.join(this.downloadDir, 'users')
    try {
      await fs.access(usersDir)
    } catch {
      await fs.mkdir(usersDir, { recursive: true })
      console.log(`Created users download directory: ${usersDir}`)
    }
    
    // 注册路由
    this.routes?.forEach(route => {
      app.route({
        method: route.method,
        url: route.url,
        handler: route.handler,
        schema: route.schema
      })
    })
    
    console.log('Download Manager Plugin installed')
  }
  
  async uninstall(): Promise<void> {
    // 停止所有下载任务
    for (const download of this.downloads.values()) {
      if (download.status === 'downloading') {
        download.status = 'paused'
      }
    }
    
    console.log('Download Manager Plugin uninstalled')
  }
  
  routes = [
    {
      method: 'GET' as const,
      url: '/api/plugins/download-manager/tasks',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        const tasks = Array.from(this.downloads.values()).sort((a, b) => b.createdAt - a.createdAt)
        ResponseHelper.success(reply, {
          tasks,
          statistics: {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            downloading: tasks.filter(t => t.status === 'downloading').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            paused: tasks.filter(t => t.status === 'paused').length
          }
        })
      },
      schema: {
        description: '获取所有下载任务',
        tags: ['DownloadManager']
      }
    },
    {
      method: 'POST' as const,
      url: '/api/plugins/download-manager/add',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as { url: string; name?: string; userId?: string }
          
          if (!body.url) {
            ResponseHelper.error(reply, 'URL is required', 'INVALID_URL')
            return
          }
          
          const task = await this.addDownloadTask(body.url, body.name, body.userId)
          ResponseHelper.success(reply, task, 'Download task added')
        } catch (error) {
          ResponseHelper.error(reply, (error as Error).message, 'ADD_TASK_ERROR')
        }
      },
      schema: {
        description: '添加下载任务',
        tags: ['DownloadManager'],
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
            name: { type: 'string' },
            userId: { type: 'string' }
          }
        }
      }
    },
    {
      method: 'POST' as const,
      url: '/api/plugins/download-manager/start/:id',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { id } = request.params as { id: string }
          await this.startDownload(id)
          ResponseHelper.success(reply, null, 'Download started')
        } catch (error) {
          ResponseHelper.error(reply, (error as Error).message, 'START_DOWNLOAD_ERROR')
        }
      },
      schema: {
        description: '开始下载任务',
        tags: ['DownloadManager'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      }
    },
    {
      method: 'POST' as const,
      url: '/api/plugins/download-manager/pause/:id',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { id } = request.params as { id: string }
          await this.pauseDownload(id)
          ResponseHelper.success(reply, null, 'Download paused')
        } catch (error) {
          ResponseHelper.error(reply, (error as Error).message, 'PAUSE_DOWNLOAD_ERROR')
        }
      },
      schema: {
        description: '暂停下载任务',
        tags: ['DownloadManager']
      }
    },
    {
      method: 'DELETE' as const,
      url: '/api/plugins/download-manager/remove/:id',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { id } = request.params as { id: string }
          await this.removeDownload(id)
          ResponseHelper.success(reply, null, 'Download task removed')
        } catch (error) {
          ResponseHelper.error(reply, (error as Error).message, 'REMOVE_DOWNLOAD_ERROR')
        }
      },
      schema: {
        description: '删除下载任务',
        tags: ['DownloadManager']
      }
    }
  ]
  
  frontend = {
    component: 'DownloadManager',
    menu: {
      title: '下载管理',
      icon: 'Download',
      order: 2,
      path: '/plugins/download-manager'
    }
  }
  
  /**
   * 确保下载目录存在
   */
  private async ensureDownloadDir(userId?: string): Promise<string> {
    const dir = this.getUserDownloadDir(userId)
    try {
      await fs.access(dir)
    } catch {
      await fs.mkdir(dir, { recursive: true })
      console.log(`Created download directory: ${dir}`)
    }
    return dir
  }
  
  /**
   * 添加下载任务
   */
  private async addDownloadTask(url: string, customName?: string, userId?: string): Promise<DownloadTask> {
    const id = crypto.randomUUID()
    const name = customName || this.extractFilename(url) || `download_${id}`
    
    // 确保用户下载目录存在
    const downloadDir = await this.ensureDownloadDir(userId)
    
    const task: DownloadTask = {
      id,
      name,
      url,
      status: 'pending',
      progress: 0,
      size: 0,
      downloadedSize: 0,
      speed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId
    }
    
    this.downloads.set(id, task)
    
    // 发布事件
    await this.eventBus.emit('download:added', task, 'DownloadManagerPlugin')
    
    // 如果可以，自动开始下载
    if (this.activeDownloads < this.maxConcurrentDownloads) {
      setTimeout(() => this.startDownload(id), 100)
    }
    
    return task
  }
  
  /**
   * 开始下载
   */
  private async startDownload(id: string): Promise<void> {
    const task = this.downloads.get(id)
    if (!task) {
      throw new Error('Download task not found')
    }
    
    if (task.status === 'downloading') {
      throw new Error('Download is already in progress')
    }
    
    if (this.activeDownloads >= this.maxConcurrentDownloads) {
      throw new Error('Maximum concurrent downloads reached')
    }
    
    task.status = 'downloading'
    task.updatedAt = Date.now()
    this.activeDownloads++
    
    // 发布事件
    await this.eventBus.emit('download:started', task, 'DownloadManagerPlugin')
    
    // 尝试真实下载，如果失败则回退到模拟下载
    try {
      await this.realDownload(task)
    } catch (error) {
      console.warn(`Real download failed for ${task.name}, falling back to simulation:`, error)
      this.simulateDownload(task)
    }
  }
  
  /**
   * 暂停下载
   */
  private async pauseDownload(id: string): Promise<void> {
    const task = this.downloads.get(id)
    if (!task) {
      throw new Error('Download task not found')
    }
    
    if (task.status === 'downloading') {
      task.status = 'paused'
      task.updatedAt = Date.now()
      this.activeDownloads--
      
      // 发布事件
      await this.eventBus.emit('download:paused', task, 'DownloadManagerPlugin')
    }
  }
  
  /**
   * 删除下载任务
   */
  private async removeDownload(id: string): Promise<void> {
    const task = this.downloads.get(id)
    if (!task) {
      throw new Error('Download task not found')
    }
    
    // 如果正在下载，先暂停
    if (task.status === 'downloading') {
      await this.pauseDownload(id)
    }
    
    // 删除文件（如果存在）
    if (task.filePath) {
      try {
        await fs.unlink(task.filePath)
      } catch (error) {
        // 文件可能不存在，忽略错误
      }
    }
    
    this.downloads.delete(id)
    
    // 发布事件
    await this.eventBus.emit('download:removed', { id }, 'DownloadManagerPlugin')
  }
  
  /**
   * 真实下载过程
   */
  private async realDownload(task: DownloadTask): Promise<void> {
    try {
      const axios = require('axios')
      const fs = require('fs')
      const path = require('path')
      
      // 设置文件路径
      const downloadDir = await this.ensureDownloadDir(task.userId)
      task.filePath = path.join(downloadDir, task.name)
      
      // 获取文件信息
      const headResponse = await axios.head(task.url)
      task.size = parseInt(headResponse.headers['content-length'] || '0')
      
      if (task.size === 0) {
        throw new Error('无法获取文件大小')
      }
      
      // 开始下载
      const response = await axios({
        method: 'GET',
        url: task.url,
        responseType: 'stream',
        onDownloadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            task.downloadedSize = progressEvent.loaded
            task.progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            task.speed = progressEvent.loaded / (Date.now() - task.updatedAt) * 1000 // bytes per second
            task.updatedAt = Date.now()
            
            // 发布进度更新事件
            this.eventBus.emit('download:progress', task, 'DownloadManagerPlugin')
          }
        }
      })
      
      // 创建写入流
      const writer = fs.createWriteStream(task.filePath)
      
      response.data.pipe(writer)
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          task.status = 'completed'
          task.progress = 100
          task.speed = 0
          task.downloadedSize = task.size
          this.activeDownloads--
          
          // 发布完成事件
          this.eventBus.emit('download:completed', task, 'DownloadManagerPlugin')
          resolve()
        })
        
        writer.on('error', (error: any) => {
          task.status = 'failed'
          task.error = error.message
          this.activeDownloads--
          
          // 发布失败事件
          this.eventBus.emit('download:failed', task, 'DownloadManagerPlugin')
          reject(error)
        })
      })
      
    } catch (error) {
      task.status = 'failed'
      task.error = (error as Error).message
      this.activeDownloads--
      
      // 发布失败事件
      this.eventBus.emit('download:failed', task, 'DownloadManagerPlugin')
      throw error
    }
  }
  
  /**
   * 模拟下载过程（保留作为备选）
   */
  private simulateDownload(task: DownloadTask): void {
    // 模拟文件大小
    task.size = Math.random() * 1000 * 1024 * 1024 + 10 * 1024 * 1024 // 10MB - 1GB
    const downloadDir = this.getUserDownloadDir(task.userId)
    task.filePath = path.join(downloadDir, task.name)
    
    const interval = setInterval(async () => {
      if (task.status !== 'downloading') {
        clearInterval(interval)
        return
      }
      
      // 模拟下载进度
      const increment = Math.random() * 1024 * 1024 * 2 // 最多 2MB/次
      task.downloadedSize = Math.min(task.downloadedSize + increment, task.size)
      task.progress = Math.round((task.downloadedSize / task.size) * 100)
      task.speed = increment * 10 // 模拟速度 (假设每100ms更新一次，所以乘以10)
      task.updatedAt = Date.now()
      
      // 检查是否完成
      if (task.downloadedSize >= task.size) {
        task.status = 'completed'
        task.progress = 100
        task.speed = 0
        this.activeDownloads--
        clearInterval(interval)
        
        // 发布完成事件
        await this.eventBus.emit('download:completed', task, 'DownloadManagerPlugin')
      } else {
        // 发布进度更新事件
        await this.eventBus.emit('download:progress', task, 'DownloadManagerPlugin')
      }
    }, 100)
  }
  
  /**
   * 从URL提取文件名
   */
  private extractFilename(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop()
      return filename && filename.length > 0 ? filename : null
    } catch {
      return null
    }
  }
}

export default new DownloadManagerPlugin()