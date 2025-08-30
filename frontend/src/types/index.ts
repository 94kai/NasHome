// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: string
  timestamp: number
}

// 插件接口
export interface PluginInfo {
  name: string
  version: string
  description: string
  author?: string
  enabled: boolean
  installed: boolean
  installTime: number
}

// 菜单配置
export interface MenuConfig {
  title: string
  icon?: string
  order?: number
  path: string
  children?: MenuConfig[]
}

// 插件组件配置
export interface PluginComponent {
  name: string
  component: any
  route?: {
    path: string
    name?: string
    meta?: Record<string, any>
  }
  menu?: MenuConfig
}

// 系统信息
export interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  memory: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  }
  uptime: number
}

// 事件负载
export interface EventPayload {
  type: string
  data?: any
  source?: string
  timestamp: number
}

// WebSocket 消息
export interface WebSocketMessage {
  type: string
  payload?: any
}