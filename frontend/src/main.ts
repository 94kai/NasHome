import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import { pluginManager } from './core/PluginManager'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  
  // 注册插件
  app.use(pinia)
  app.use(router)
  app.use(ElementPlus)
  
  // 注册所有图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }
  
  // 初始化插件管理器
  pluginManager.initialize(app)
  
  // 加载内置插件
  await loadBuiltinPlugins()
  
  // 挂载应用
  app.mount('#app')
}

/**
 * 加载内置插件
 */
async function loadBuiltinPlugins() {
  // 这里可以加载一些内置的插件组件
  // 例如网络状态、下载管理等
  
  // 示例：动态加载插件
  try {
    // 网络状态插件
    const networkPlugin = await import('@/plugins/network-status/index.vue')
    pluginManager.register({
      name: 'NetworkStatus',
      component: networkPlugin.default,
      route: {
        path: '/plugins/network-status',
        name: 'plugin-network-status'
      },
      menu: {
        title: '网络状态',
        icon: 'Connection',
        order: 1,
        path: '/plugins/network-status'
      }
    })
    
    // 下载管理插件
    const downloadPlugin = await import('@/plugins/download-manager/index.vue')
    pluginManager.register({
      name: 'DownloadManager',
      component: downloadPlugin.default,
      route: {
        path: '/plugins/download-manager',
        name: 'plugin-download-manager'
      },
      menu: {
        title: '下载管理',
        icon: 'Download',
        order: 2,
        path: '/plugins/download-manager'
      }
    })
    
    // 笔记插件
    const notesPlugin = await import('@/plugins/notes/index.vue')
    pluginManager.register({
      name: 'Notes',
      component: notesPlugin.default,
      route: {
        path: '/plugins/notes',
        name: 'plugin-notes'
      },
      menu: {
        title: '我的笔记',
        icon: 'Document',
        order: 1,
        path: '/plugins/notes'
      }
    })
  } catch (error) {
    console.warn('Failed to load some plugins:', error)
  }
}

// 启动应用
bootstrap().catch(error => {
  console.error('Failed to bootstrap app:', error)
})