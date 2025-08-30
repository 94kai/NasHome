import { EventPayload, EventHandler } from '@/types'

/**
 * 事件总线 - 用于插件间通信
 */
export class EventBus {
  private static instance: EventBus
  private listeners: Map<string, EventHandler[]> = new Map()
  
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }
  
  /**
   * 订阅事件
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType)!.push(handler)
  }
  
  /**
   * 取消订阅
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.listeners.get(eventType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }
  
  /**
   * 发布事件
   */
  async emit(eventType: string, data?: any, source?: string): Promise<void> {
    const handlers = this.listeners.get(eventType) || []
    const payload: EventPayload = {
      type: eventType,
      data,
      source,
      timestamp: Date.now()
    }
    
    // 并发执行所有处理器
    await Promise.allSettled(
      handlers.map(handler => {
        try {
          return Promise.resolve(handler(payload))
        } catch (error) {
          console.error(`Event handler error for ${eventType}:`, error)
          return Promise.reject(error)
        }
      })
    )
  }
  
  /**
   * 获取所有事件类型
   */
  getEventTypes(): string[] {
    return Array.from(this.listeners.keys())
  }
  
  /**
   * 清空所有监听器
   */
  clear(): void {
    this.listeners.clear()
  }
}