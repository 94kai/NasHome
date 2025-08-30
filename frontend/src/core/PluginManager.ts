import type { App, Component, AsyncComponentLoader } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { PluginComponent, MenuConfig } from '@/types'

/**
 * 前端插件管理器
 */
export class PluginManager {
  private plugins: Map<string, PluginComponent> = new Map()
  private app: App | null = null

  /**
   * 初始化插件管理器
   */
  initialize(app: App) {
    this.app = app
  }

  /**
   * 注册插件组件
   */
  register(pluginComponent: PluginComponent) {
    this.plugins.set(pluginComponent.name, pluginComponent)
    
    // 全局注册组件
    if (this.app) {
      this.app.component(`Plugin${pluginComponent.name}`, pluginComponent.component)
    }

    console.log(`Plugin component registered: ${pluginComponent.name}`)
  }

  /**
   * 批量注册插件
   */
  registerAll(plugins: PluginComponent[]) {
    plugins.forEach(plugin => this.register(plugin))
  }

  /**
   * 获取插件组件
   */
  getPlugin(name: string): PluginComponent | undefined {
    return this.plugins.get(name)
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): PluginComponent[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 动态加载插件组件
   */
  async loadPluginComponent(name: string): Promise<Component | null> {
    try {
      // 尝试动态导入插件组件
      const module = await import(`@/plugins/${name}/index.vue`)
      return module.default
    } catch (error) {
      console.error(`Failed to load plugin component: ${name}`, error)
      return null
    }
  }

  /**
   * 创建插件路由
   */
  createPluginRoute(plugin: PluginComponent): RouteRecordRaw {
    return {
      path: plugin.route?.path || `/plugins/${plugin.name}`,
      name: plugin.route?.name || `plugin-${plugin.name}`,
      component: plugin.component,
      meta: {
        title: plugin.menu?.title || plugin.name,
        icon: plugin.menu?.icon,
        ...plugin.route?.meta
      }
    }
  }

  /**
   * 获取所有插件路由
   */
  getPluginRoutes(): RouteRecordRaw[] {
    return this.getAllPlugins()
      .filter(plugin => plugin.route)
      .map(plugin => this.createPluginRoute(plugin))
  }

  /**
   * 获取插件菜单配置
   */
  getPluginMenus(): MenuConfig[] {
    return this.getAllPlugins()
      .filter(plugin => plugin.menu)
      .map(plugin => ({
        ...plugin.menu!,
        path: plugin.route?.path || `/plugins/${plugin.name}`
      }))
      .sort((a, b) => (a.order || 999) - (b.order || 999))
  }

  /**
   * 卸载插件
   */
  unregister(name: string): boolean {
    return this.plugins.delete(name)
  }

  /**
   * 清空所有插件
   */
  clear() {
    this.plugins.clear()
  }
}

// 创建全局插件管理器实例
export const pluginManager = new PluginManager()