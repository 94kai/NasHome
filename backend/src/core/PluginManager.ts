import { FastifyInstance } from 'fastify'
import { IPlugin, PluginRegistry, MenuConfig } from '@/types'
import { EventBus } from './EventBus'
import { SQLiteAdapter } from './Database'
import * as path from 'path'
import * as fs from 'fs/promises'

/**
 * 插件管理器
 */
export class PluginManager {
  private plugins: PluginRegistry = {}
  private app: FastifyInstance
  private eventBus: EventBus
  private db: SQLiteAdapter
  private pluginDir: string
  
  constructor(app: FastifyInstance, db: SQLiteAdapter, pluginDir: string) {
    this.app = app
    this.db = db
    this.eventBus = EventBus.getInstance()
    this.pluginDir = pluginDir
  }
  
  /**
   * 加载插件目录中的所有插件
   */
  async loadPlugins(): Promise<void> {
    try {
      const pluginDirs = await fs.readdir(this.pluginDir)
      
      for (const dir of pluginDirs) {
        const pluginPath = path.join(this.pluginDir, dir)
        const stat = await fs.stat(pluginPath)
        
        if (stat.isDirectory()) {
          await this.loadPlugin(pluginPath)
        }
      }
      
      console.log(`Loaded ${Object.keys(this.plugins).length} plugins`)
    } catch (error) {
      console.error('Failed to load plugins:', error)
    }
  }
  
  /**
   * 加载单个插件
   */
  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const indexPath = path.join(pluginPath, 'index.ts')
      
      // 动态导入插件
      const pluginModule = await import(indexPath)
      const plugin: IPlugin = pluginModule.default || pluginModule
      
      if (!plugin.name || !plugin.version) {
        throw new Error('Plugin must have name and version')
      }
      
      // 检查依赖
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!this.plugins[dep]?.enabled) {
            throw new Error(`Plugin dependency not met: ${dep}`)
          }
        }
      }
      
      // 注册插件
      this.plugins[plugin.name] = {
        plugin,
        installed: false,
        enabled: false,
        installTime: Date.now()
      }
      
      console.log(`Plugin loaded: ${plugin.name} v${plugin.version}`)
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error)
    }
  }
  
  /**
   * 安装插件
   */
  async installPlugin(pluginName: string): Promise<void> {
    const pluginInfo = this.plugins[pluginName]
    if (!pluginInfo) {
      throw new Error(`Plugin not found: ${pluginName}`)
    }
    
    if (pluginInfo.installed) {
      throw new Error(`Plugin already installed: ${pluginName}`)
    }
    
    try {
      const plugin = pluginInfo.plugin
      
      // 执行插件安装（插件内部会注册自己的路由）
      await plugin.install(this.app)
      
      // 更新状态
      pluginInfo.installed = true
      pluginInfo.enabled = true
      
      // 保存到数据库
      await this.db.run(
        'INSERT OR REPLACE INTO plugins (name, version, enabled, install_time) VALUES (?, ?, ?, ?)',
        [plugin.name, plugin.version, 1, Date.now()]
      )
      
      // 发布事件
      await this.eventBus.emit('plugin:installed', { pluginName }, 'PluginManager')
      
      console.log(`Plugin installed: ${pluginName}`)
    } catch (error) {
      console.error(`Failed to install plugin ${pluginName}:`, error)
      throw error
    }
  }
  
  /**
   * 卸载插件
   */
  async uninstallPlugin(pluginName: string): Promise<void> {
    const pluginInfo = this.plugins[pluginName]
    if (!pluginInfo || !pluginInfo.installed) {
      throw new Error(`Plugin not installed: ${pluginName}`)
    }
    
    try {
      const plugin = pluginInfo.plugin
      
      // 执行插件卸载
      if (plugin.uninstall) {
        await plugin.uninstall(this.app)
      }
      
      // 更新状态
      pluginInfo.installed = false
      pluginInfo.enabled = false
      
      // 从数据库删除
      await this.db.run('DELETE FROM plugins WHERE name = ?', [pluginName])
      
      // 发布事件
      await this.eventBus.emit('plugin:uninstalled', { pluginName }, 'PluginManager')
      
      console.log(`Plugin uninstalled: ${pluginName}`)
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginName}:`, error)
      throw error
    }
  }
  
  /**
   * 启用/禁用插件
   */
  async togglePlugin(pluginName: string, enabled: boolean): Promise<void> {
    const pluginInfo = this.plugins[pluginName]
    if (!pluginInfo || !pluginInfo.installed) {
      throw new Error(`Plugin not installed: ${pluginName}`)
    }
    
    pluginInfo.enabled = enabled
    
    await this.db.run(
      'UPDATE plugins SET enabled = ? WHERE name = ?',
      [enabled ? 1 : 0, pluginName]
    )
    
    await this.eventBus.emit('plugin:toggled', { pluginName, enabled }, 'PluginManager')
  }
  
  /**
   * 获取所有插件信息
   */
  getPlugins(): any {
    // 过滤掉包含循环引用的属性，只返回可序列化的数据
    const safePlugins: any = {}
    
    for (const [name, info] of Object.entries(this.plugins)) {
      safePlugins[name] = {
        name: info.plugin.name,
        version: info.plugin.version,
        description: info.plugin.description,
        author: info.plugin.author,
        dependencies: info.plugin.dependencies,
        installed: info.installed,
        enabled: info.enabled,
        installTime: info.installTime,
        frontend: info.plugin.frontend
      }
    }
    
    return safePlugins
  }
  
  /**
   * 获取启用的插件
   */
  getEnabledPlugins(): any[] {
    return Object.values(this.plugins)
      .filter(info => info.enabled)
      .map(info => ({
        name: info.plugin.name,
        version: info.plugin.version,
        description: info.plugin.description,
        author: info.plugin.author,
        dependencies: info.plugin.dependencies,
        frontend: info.plugin.frontend
      }))
  }
  
  /**
   * 获取插件菜单配置
   */
  getPluginMenus(): MenuConfig[] {
    return Object.values(this.plugins)
      .filter(info => info.enabled && info.plugin.frontend?.menu)
      .map(info => ({
        ...info.plugin.frontend!.menu!
      }))
      .sort((a, b) => (a.order || 999) - (b.order || 999))
  }
  
  /**
   * 自动安装所有已加载的插件
   */
  async autoInstall(): Promise<void> {
    const pluginNames = Object.keys(this.plugins)
    
    for (const pluginName of pluginNames) {
      try {
        await this.installPlugin(pluginName)
      } catch (error) {
        console.error(`Auto install failed for ${pluginName}:`, error)
      }
    }
  }
}