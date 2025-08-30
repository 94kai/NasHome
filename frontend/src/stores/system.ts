import { defineStore } from 'pinia'
import { systemApi } from '@/api/system'
import type { SystemInfo, PluginInfo, MenuConfig } from '@/types'

export const useSystemStore = defineStore('system', {
  state: () => ({
    systemInfo: null as SystemInfo | null,
    plugins: {} as Record<string, PluginInfo>,
    menus: [] as MenuConfig[],
    loading: false,
    connected: false
  }),

  getters: {
    enabledPlugins: (state) => {
      return Object.values(state.plugins).filter(plugin => plugin.enabled)
    },
    
    installedPlugins: (state) => {
      return Object.values(state.plugins).filter(plugin => plugin.installed)
    }
  },

  actions: {
    // 加载系统信息
    async loadSystemInfo() {
      try {
        this.loading = true
        const response = await systemApi.getSystemInfo()
        this.systemInfo = response.data!
      } catch (error) {
        console.error('Failed to load system info:', error)
      } finally {
        this.loading = false
      }
    },

    // 加载插件信息
    async loadPlugins() {
      try {
        const response = await systemApi.getPlugins()
        this.plugins = response.data!
      } catch (error) {
        console.error('Failed to load plugins:', error)
      }
    },

    // 加载菜单配置
    async loadMenus() {
      try {
        const response = await systemApi.getPluginMenus()
        this.menus = response.data!
      } catch (error) {
        console.error('Failed to load menus:', error)
      }
    },

    // 切换插件状态
    async togglePlugin(pluginName: string, enabled: boolean) {
      try {
        await systemApi.togglePlugin(pluginName, enabled)
        
        // 更新本地状态
        if (this.plugins[pluginName]) {
          this.plugins[pluginName].enabled = enabled
        }
        
        // 重新加载菜单
        await this.loadMenus()
        
        return true
      } catch (error) {
        console.error('Failed to toggle plugin:', error)
        return false
      }
    },

    // 健康检查
    async healthCheck() {
      try {
        await systemApi.health()
        this.connected = true
        return true
      } catch (error) {
        this.connected = false
        return false
      }
    },

    // 初始化应用数据
    async initialize() {
      await Promise.allSettled([
        this.loadSystemInfo(),
        this.loadPlugins(),
        this.loadMenus(),
        this.healthCheck()
      ])
    }
  }
})