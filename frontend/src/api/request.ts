import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '@/types'

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token 并添加到请求头
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { data } = response
    
    // 检查业务状态码
    if (data.success) {
      return response
    } else {
      ElMessage.error(data.message || 'Request failed')
      return Promise.reject(new Error(data.message || 'Request failed'))
    }
  },
  (error) => {
    console.error('API Error:', error)
    
    // 处理 401 未授权错误
    if (error.response?.status === 401) {
      // 清除无效的 token
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      // 重定向到登录页面
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      
      ElMessage.error('登录已过期，请重新登录')
      return Promise.reject(new Error('Unauthorized'))
    }
    
    let message = 'Request failed'
    if (error.response?.data?.message) {
      message = error.response.data.message
    } else if (error.message) {
      message = error.message
    }
    
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

// 封装常用方法
export const api = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.get(url, config).then(res => res.data)
  },
  
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.post(url, data, config).then(res => res.data)
  },
  
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.put(url, data, config).then(res => res.data)
  },
  
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.delete(url, config).then(res => res.data)
  },
  
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return request.patch(url, data, config).then(res => res.data)
  }
}

export default request