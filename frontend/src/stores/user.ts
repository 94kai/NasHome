import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/request'

interface User {
  id: number
  username: string
  email?: string
}

interface LoginForm {
  username: string
  password: string
}

interface RegisterForm {
  username: string
  password: string
  email?: string
}

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  
  const isAuthenticated = computed(() => !!token.value)
  
  // 初始化用户状态
  const initUser = () => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      user.value = JSON.parse(storedUser)
    }
  }
  
  // 用户登录
  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/login', { username, password })

      if (response.success && response.data?.token) {
        token.value = response.data.token
        user.value = {
          id: response.data.id,
          username,
          email: response.data.email
        }

        // 保存到本地存储
        if (token.value) {
          localStorage.setItem('token', token.value)
        }
        localStorage.setItem('user', JSON.stringify(user.value))

        return true
      }
      return false
    } catch (error: any) {
      console.error('Login error:', error)
      throw new Error(error.message || '登录失败')
    }
  }
  
  // 用户注册
  const register = async (username: string, password: string, email?: string) => {
    try {
      const response = await api.post('/register', { username, password, email })
      
      if (response.success) {
        return true
      }
      return false
    } catch (error: any) {
      console.error('Register error:', error)
      throw new Error(error.message || '注册失败')
    }
  }
  
  // 用户登出
  const logout = () => {
    user.value = null
    token.value = null
    
    // 清除本地存储
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
  
  // 初始化
  initUser()
  
  return {
    user,
    token,
    isAuthenticated,
    login,
    register,
    logout
  }
})