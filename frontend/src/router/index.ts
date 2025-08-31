import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { pluginManager } from '@/core/PluginManager'
import { useUserStore } from '@/stores/user'

// 基础路由
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: {
      title: '仪表盘',
      icon: 'HomeFilled',
      requiresAuth: true
    }
  },

  {
    path: '/plugins',
    name: 'PluginManager',
    component: () => import('@/views/PluginManager.vue'),
    meta: {
      title: '插件管理',
      icon: 'Grid',
      requiresAuth: true
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: {
      title: '系统设置',
      icon: 'Setting',
      requiresAuth: true
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '用户登录',
      icon: 'UserFilled'
    }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: {
      title: '用户注册',
      icon: 'UserFilled'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 动态添加插件路由
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()

  // 等待用户状态初始化完成
  if (!userStore.initialized) {
    await userStore.initUser()
  }

  // 检查是否需要认证
  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    // 重定向到登录页
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // 如果用户已登录且访问的是登录或注册页面，重定向到首页
  if (userStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
    next({ path: '/' })
    return
  }

  // 对于需要认证的路由，如果没有登录，强制跳转到登录页
  if (to.meta.requiresAuth === true && !userStore.isAuthenticated) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // 确保插件路由已加载
  const pluginRoutes = pluginManager.getPluginRoutes()
  pluginRoutes.forEach(route => {
    if (!router.hasRoute(route.name!)) {
      console.log('adding plugin route:', route.path)
      router.addRoute(route)
    }
  })

  // 如果路由不存在，可能是动态添加的，重新解析
  if (to.matched.length === 0) {
    const resolved = router.resolve(to.path)
    if (resolved.matched.length > 0) {
      next({ ...to, replace: true })
      return
    }
  }

  next()
})

export default router