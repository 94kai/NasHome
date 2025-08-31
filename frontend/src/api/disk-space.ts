import { api } from './request'

// 磁盘信息类型定义
export interface DiskInfo {
  mount: string
  total: number
  used: number
  available: number
  usePercent: number
}

/**
 * 磁盘空间相关 API
 */
export const diskSpaceApi = {
  // 获取所有磁盘信息
  getDiskSpace() {
    return api.get<{
      success: boolean
      data: DiskInfo[]
      message?: string
      timestamp: number
    }>('/api/disk-space')
  },

  // 获取主要磁盘信息
  getMainDiskInfo() {
    return api.get<{
      success: boolean
      data: DiskInfo | null
      message?: string
      timestamp: number
    }>('/api/disk-space/main')
  }
}

