import { FastifyReply } from 'fastify'
import { ApiResponse } from '@/types'

/**
 * 统一的 API 响应工具
 */
export class ResponseHelper {
  /**
   * 成功响应
   */
  static success<T = any>(reply: FastifyReply, data?: T, message?: string): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message: message || 'Success',
      timestamp: Date.now()
    }
    reply.send(response)
  }
  
  /**
   * 错误响应
   */
  static error(reply: FastifyReply, message: string, code?: string, statusCode = 400): void {
    const response: ApiResponse = {
      success: false,
      message,
      code,
      timestamp: Date.now()
    }
    reply.status(statusCode).send(response)
  }
  
  /**
   * 分页响应
   */
  static paginated<T = any>(
    reply: FastifyReply,
    data: T[],
    page: number,
    size: number,
    total: number,
    message?: string
  ): void {
    const response: ApiResponse<{
      items: T[]
      pagination: {
        page: number
        size: number
        total: number
        pages: number
      }
    }> = {
      success: true,
      data: {
        items: data,
        pagination: {
          page,
          size,
          total,
          pages: Math.ceil(total / size)
        }
      },
      message: message || 'Success',
      timestamp: Date.now()
    }
    reply.send(response)
  }
}