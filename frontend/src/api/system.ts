import { api } from './request'
import type { SystemInfo, PluginInfo, MenuConfig } from '@/types'

/**
 * 系统相关 API
 */
export const systemApi = {
  // 健康检查
  health() {
    return api.get<{
      status: string
      timestamp: number
      uptime: number
    }>('/health')
  },

  // 获取系统信息
  getSystemInfo() {
    return api.get<SystemInfo>('/system/info')
  },

  // 获取所有插件
  getPlugins() {
    return api.get<Record<string, PluginInfo>>('/plugins')
  },

  // 获取插件菜单
  getPluginMenus() {
    return api.get<MenuConfig[]>('/plugins/menus')
  },

  // 切换插件状态
  togglePlugin(name: string, enabled: boolean) {
    return api.post(`/plugins/${name}/toggle`, { enabled })
  },

  // 获取事件类型
  getEventTypes() {
    return api.get<string[]>('/events/types')
  }
}