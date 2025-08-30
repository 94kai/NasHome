<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <!-- 系统概览 -->
      <el-col :span="24" :md="12" :lg="8">
        <el-card class="overview-card">
          <template #header>
            <div class="card-header">
              <el-icon><Monitor /></el-icon>
              <span>系统状态</span>
            </div>
          </template>
          
          <div v-if="systemInfo" class="overview-content">
            <div class="overview-item">
              <span class="label">平台:</span>
              <span class="value">{{ systemInfo.platform }} {{ systemInfo.arch }}</span>
            </div>
            <div class="overview-item">
              <span class="label">运行时间:</span>
              <span class="value">{{ formatUptime(systemInfo.uptime) }}</span>
            </div>
            <div class="overview-item">
              <span class="label">Node版本:</span>
              <span class="value">{{ systemInfo.nodeVersion }}</span>
            </div>
          </div>
          
          <el-skeleton v-else :rows="3" animated />
        </el-card>
      </el-col>
      
      <!-- 内存使用 -->
      <el-col :span="24" :md="12" :lg="8">
        <el-card class="overview-card">
          <template #header>
            <div class="card-header">
              <el-icon><Cpu /></el-icon>
              <span>内存使用</span>
            </div>
          </template>
          
          <div v-if="systemInfo" class="memory-content">
            <div class="memory-item">
              <span class="label">堆内存:</span>
              <el-progress
                :percentage="heapUsagePercent"
                :format="() => formatMemory(systemInfo!.memory.heapUsed)"
                class="memory-progress"
              />
            </div>
            <div class="memory-stats">
              <span>总计: {{ formatMemory(systemInfo.memory.heapTotal) }}</span>
              <span>RSS: {{ formatMemory(systemInfo.memory.rss) }}</span>
            </div>
          </div>
          
          <el-skeleton v-else :rows="2" animated />
        </el-card>
      </el-col>
      
      <!-- 插件状态 -->
      <el-col :span="24" :md="24" :lg="8">
        <el-card class="overview-card">
          <template #header>
            <div class="card-header">
              <el-icon><Grid /></el-icon>
              <span>插件状态</span>
            </div>
          </template>
          
          <div class="plugin-stats">
            <div class="stat-item">
              <el-statistic title="已安装" :value="installedCount" />
            </div>
            <div class="stat-item">
              <el-statistic title="已启用" :value="enabledCount" />
            </div>
            <div class="stat-item">
              <el-statistic title="总数" :value="totalCount" />
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 插件列表 -->
    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><List /></el-icon>
              <span>已启用的插件</span>
            </div>
          </template>
          
          <div v-if="enabledPlugins.length > 0" class="plugin-list">
            <div
              v-for="plugin in enabledPlugins"
              :key="plugin.name"
              class="plugin-item"
            >
              <div class="plugin-info">
                <div class="plugin-name">{{ plugin.name }}</div>
                <div class="plugin-desc">{{ plugin.description }}</div>
              </div>
              <div class="plugin-meta">
                <el-tag size="small">v{{ plugin.version }}</el-tag>
                <el-tag v-if="plugin.author" size="small" type="info">
                  {{ plugin.author }}
                </el-tag>
              </div>
            </div>
          </div>
          
          <el-empty v-else description="暂无启用的插件" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 实时日志 -->
    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><Document /></el-icon>
              <span>实时事件</span>
              <el-button
                size="small"
                @click="clearLogs"
                style="margin-left: auto;"
              >
                清空
              </el-button>
            </div>
          </template>
          
          <div class="event-logs">
            <div
              v-for="(event, index) in recentEvents"
              :key="index"
              class="log-item"
            >
              <span class="log-time">{{ formatTime(event.timestamp) }}</span>
              <span class="log-source">{{ event.source || 'System' }}</span>
              <span class="log-type">{{ event.type }}</span>
              <span class="log-data">{{ JSON.stringify(event.data || {}) }}</span>
            </div>
          </div>
          
          <el-empty v-if="recentEvents.length === 0" description="暂无事件记录" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { wsManager } from '@/core/WebSocketManager'
import type { EventPayload } from '@/types'
import {
  Monitor,
  Cpu,
  Grid,
  List,
  Document
} from '@element-plus/icons-vue'

const systemStore = useSystemStore()
const recentEvents = ref<EventPayload[]>([])
const maxEvents = 50

// 计算属性
const systemInfo = computed(() => systemStore.systemInfo)
const enabledPlugins = computed(() => systemStore.enabledPlugins)
const installedPlugins = computed(() => systemStore.installedPlugins)

const installedCount = computed(() => installedPlugins.value.length)
const enabledCount = computed(() => enabledPlugins.value.length)
const totalCount = computed(() => Object.keys(systemStore.plugins).length)

const heapUsagePercent = computed(() => {
  if (!systemInfo.value) return 0
  const { heapUsed, heapTotal } = systemInfo.value.memory
  return Math.round((heapUsed / heapTotal) * 100)
})

// 方法
const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}天 ${hours}小时`
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`
  } else {
    return `${minutes}分钟`
  }
}

const formatMemory = (bytes: number) => {
  const mb = (bytes / 1024 / 1024).toFixed(1)
  return `${mb}MB`
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

const addEvent = (event: EventPayload) => {
  recentEvents.value.unshift(event)
  if (recentEvents.value.length > maxEvents) {
    recentEvents.value.pop()
  }
}

const clearLogs = () => {
  recentEvents.value = []
}

// 生命周期
onMounted(async () => {
  // 初始化系统数据
  await systemStore.initialize()
  
  // 监听所有事件
  wsManager.on('*', addEvent)
})

onUnmounted(() => {
  wsManager.off('*', addEvent)
})
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}

.mt-20 {
  margin-top: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.overview-card {
  height: 200px;
}

.overview-content {
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.overview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.label {
  color: #909399;
  font-size: 14px;
}

.value {
  font-weight: 500;
  color: #303133;
}

.memory-content {
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.memory-item {
  margin-bottom: 16px;
}

.memory-progress {
  margin-top: 8px;
}

.memory-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}

.plugin-stats {
  height: 120px;
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.stat-item {
  text-align: center;
}

.plugin-list {
  max-height: 300px;
  overflow-y: auto;
}

.plugin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 8px;
  background-color: #fafafa;
}

.plugin-info {
  flex: 1;
}

.plugin-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.plugin-desc {
  font-size: 12px;
  color: #909399;
}

.plugin-meta {
  display: flex;
  gap: 8px;
}

.event-logs {
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-item {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.log-time {
  color: #909399;
  min-width: 80px;
}

.log-source {
  color: #409eff;
  min-width: 80px;
}

.log-type {
  color: #67c23a;
  min-width: 120px;
}

.log-data {
  color: #303133;
  flex: 1;
}
</style>