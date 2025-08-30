import type { EventPayload, WebSocketMessage } from '@/types'

/**
 * WebSocket 管理器
 */
export class WebSocketManager {
  private ws: WebSocket | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 3000
  private listeners: Map<string, Array<(payload: EventPayload) => void>> = new Map()

  /**
   * 连接 WebSocket
   */
  connect(url?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = url || `ws://${window.location.host}/api/ws`
      
      try {
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
          }
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = () => {
          console.log('WebSocket disconnected')
          this.ws = null
          this.scheduleReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * 发送消息
   */
  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WebSocketMessage) {
    if (message.type === 'event' && message.payload) {
      this.emitEvent(message.payload)
    }
  }

  /**
   * 订阅事件
   */
  on(eventType: string, handler: (payload: EventPayload) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType)!.push(handler)
  }

  /**
   * 取消订阅
   */
  off(eventType: string, handler: (payload: EventPayload) => void) {
    const handlers = this.listeners.get(eventType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(payload: EventPayload) {
    // 触发具体事件类型的监听器
    const handlers = this.listeners.get(payload.type) || []
    handlers.forEach(handler => {
      try {
        handler(payload)
      } catch (error) {
        console.error(`Event handler error for ${payload.type}:`, error)
      }
    })

    // 触发通配符监听器
    const allHandlers = this.listeners.get('*') || []
    allHandlers.forEach(handler => {
      try {
        handler(payload)
      } catch (error) {
        console.error(`Wildcard event handler error:`, error)
      }
    })
  }

  /**
   * 计划重连
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      this.connect().catch(error => {
        console.error('Reconnect failed:', error)
      })
    }, this.reconnectInterval)
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

// 创建全局 WebSocket 管理器实例
export const wsManager = new WebSocketManager()