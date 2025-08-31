<template>
  <!-- 加载状态 -->
  <div v-if="!userStore.initialized || userStore.initializing" class="loading-container">
    <el-icon size="48" class="is-loading">
      <Loading />
    </el-icon>
    <p>正在加载...</p>
  </div>

  <!-- 登录页直接显示 -->
  <router-view v-else-if="$route.path === '/login' || $route.path === '/register'" />

  <!-- 已登录用户显示主界面 -->
  <el-container v-else-if="userStore.isAuthenticated" class="layout-container">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapsed ? '64px' : '250px'" class="sidebar">
      <div class="logo">
        <el-icon size="32">
          <Box />
        </el-icon>
        <span v-show="!isCollapsed" class="logo-text">NAS服务</span>
      </div>
      
      <el-menu
        :default-active="$route.path"
        :default-openeds="['plugins']"
        :collapse="isCollapsed"
        router
        class="sidebar-menu"
      >
        <!-- 基础菜单 -->
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        
        <!-- 插件菜单 -->
        <el-sub-menu v-if="pluginMenus.length > 0" index="plugins">
          <template #title>
            <el-icon><Grid /></el-icon>
            <span>服务功能</span>
          </template>
          <el-menu-item
            v-for="menu in pluginMenus"
            :key="menu.path"
            :index="menu.path"
          >
            <el-icon v-if="menu.icon">
              <component :is="menu.icon" />
            </el-icon>
            <span>{{ menu.title }}</span>
          </el-menu-item>
        </el-sub-menu>
        
        <el-menu-item index="/plugins">
          <el-icon><Grid /></el-icon>
          <span>插件管理</span>
        </el-menu-item>
        
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶部栏 -->
      <el-header class="header">
        <div class="header-left">
          <el-button
            :icon="isCollapsed ? Expand : Fold"
            @click="toggleSidebar"
            text
          />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item to="/">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ $route.meta.title || $route.name }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <!-- 连接状态 -->
          <el-tag :type="connected ? 'success' : 'danger'" size="small">
            {{ connected ? '已连接' : '未连接' }}
          </el-tag>
          
          <!-- 用户信息 -->
          <template v-if="userStore.isAuthenticated">
            <el-dropdown trigger="hover">
              <div class="user-info">
                <el-avatar :size="32" :icon="UserFilled" />
                <span class="username">{{ userStore.user?.username }}</span>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <el-button type="primary" @click="$router.push('/login')">登录</el-button>
            <el-button @click="$router.push('/register')">注册</el-button>
          </template>
          
          <!-- 系统信息 -->
          <el-dropdown trigger="hover">
            <el-button :icon="User" text />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>系统负载: {{ formatUptime(systemInfo?.uptime) }}</el-dropdown-item>
                <el-dropdown-item>内存使用: {{ formatMemory(systemInfo?.memory.heapUsed) }}</el-dropdown-item>
                <el-dropdown-item divided @click="handleRefresh">刷新数据</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <!-- 未登录用户自动重定向到登录页 -->
  <div v-else class="unauthenticated-container">
    <div class="redirect-message">
      <el-icon size="48" class="redirect-icon">
        <User />
      </el-icon>
      <h3>需要登录</h3>
      <p>正在跳转到登录页面...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useUserStore } from '@/stores/user'
import { wsManager } from '@/core/WebSocketManager'
import {
  Box,
  HomeFilled,
  Grid,
  Setting,
  Expand,
  Fold,
  User,
  UserFilled,
  Loading
} from '@element-plus/icons-vue'

const systemStore = useSystemStore()
const userStore = useUserStore()
const router = useRouter()
const isCollapsed = ref(false)

// 计算属性
const connected = computed(() => systemStore.connected)
const systemInfo = computed(() => systemStore.systemInfo)
const pluginMenus = computed(() => systemStore.menus)

// 方法
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleRefresh = async () => {
  await systemStore.initialize()
}

const formatUptime = (seconds?: number) => {
  if (!seconds) return 'Unknown'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

const formatMemory = (bytes?: number) => {
  if (!bytes) return 'Unknown'
  const mb = (bytes / 1024 / 1024).toFixed(1)
  return `${mb}MB`
}

const handleLogout = async () => {
  await userStore.logout()
  router.push('/login')
}

// 生命周期
onMounted(async () => {
  // 等待用户状态初始化完成
  if (!userStore.initialized) {
    await userStore.initUser()
  }

  // 如果用户未登录，跳转到登录页
  if (!userStore.isAuthenticated) {
    router.push('/login')
    return
  }

  // 初始化系统数据
  await systemStore.initialize()

  // 连接 WebSocket
  try {
    await wsManager.connect()

    // 监听插件状态变化
    wsManager.on('plugin:installed', () => {
      systemStore.loadPlugins()
      systemStore.loadMenus()
    })

    wsManager.on('plugin:uninstalled', () => {
      systemStore.loadPlugins()
      systemStore.loadMenus()
    })

    wsManager.on('plugin:toggled', () => {
      systemStore.loadPlugins()
      systemStore.loadMenus()
    })
  } catch (error) {
    console.error('Failed to connect WebSocket:', error)
  }
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  color: white;
  font-size: 18px;
  font-weight: bold;
  gap: 8px;
}

.logo-text {
  transition: opacity 0.3s;
}

.sidebar-menu {
  border-right: none;
  background-color: #304156;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.username {
  margin-left: 8px;
  font-size: 14px;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  color: #bfcbd9 !important;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background-color: #263445 !important;
  color: #409eff !important;
}

:deep(.el-menu-item.is-active) {
  background-color: #409eff !important;
  color: white !important;
}

/* 修复子菜单背景颜色 */
:deep(.el-sub-menu .el-menu-item) {
  background-color: #1f2d3d !important;
  color: #bfcbd9 !important;
}

:deep(.el-sub-menu .el-menu-item:hover) {
  background-color: #263445 !important;
  color: #409eff !important;
}

:deep(.el-sub-menu .el-menu-item.is-active) {
  background-color: #409eff !important;
  color: white !important;
}

/* 子菜单容器背景 */
:deep(.el-sub-menu .el-menu) {
  background-color: #1f2d3d !important;
}

.header {
  background-color: white;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
}

/* 加载状态样式 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
}

.loading-container p {
  color: #666;
  font-size: 14px;
}

.loading-container .el-icon {
  animation: loading-rotate 2s linear infinite;
}

@keyframes loading-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 未登录状态样式 */
.unauthenticated-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f5f5f5;
}

.redirect-message {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.redirect-icon {
  color: #409eff;
  margin-bottom: 16px;
}

.redirect-message h3 {
  margin: 0 0 8px 0;
  color: #303133;
}

.redirect-message p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}
</style>