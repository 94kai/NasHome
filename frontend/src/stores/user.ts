import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/request'

interface User {
  id: number
  username: string
}

interface LoginForm {
  username: string
  password: string
}

interface RegisterForm {
  username: string
  password: string
}

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const initialized = ref(false)
  const initializing = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  // 初始化用户状态
  const initUser = async () => {
    if (initialized.value) return
    if (initializing.value) return

    initializing.value = true

    try {
      const storedUser = localStorage.getItem('user')
      const storedToken = localStorage.getItem('token')

      if (storedToken && storedUser) {
        token.value = storedToken
        user.value = JSON.parse(storedUser)
        initialized.value = true
      } else {
        // 如果没有存储的用户信息，清除可能的残留token
        token.value = null
        user.value = null
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        initialized.value = true
      }
    } catch (error) {
      console.error('Failed to initialize user:', error)
      token.value = null
      user.value = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      initialized.value = true
    } finally {
      initializing.value = false
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
          username
        }

        // 保存到本地存储
        if (token.value) {
          localStorage.setItem('token', token.value)
        }
        localStorage.setItem('user', JSON.stringify(user.value))

        // 更新初始化状态
        initialized.value = true

        return true
      }
      return false
    } catch (error: any) {
      console.error('Login error:', error)
      throw new Error(error.message || '登录失败')
    }
  }
  
  // 用户注册
  const register = async (username: string, password: string) => {
    try {
      const response = await api.post('/register', { username, password })

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
    initialized.value = true // 登出后也算是初始化完成

    // 清除本地存储
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  // 初始化（异步）
  initUser()

  return {
    user,
    token,
    initialized,
    initializing,
    isAuthenticated,
    initUser,
    login,
    register,
    logout
  }
})