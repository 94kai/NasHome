<template>
  <div class="download-manager">
    <!-- 操作栏 -->
    <el-card class="mb-20">
      <el-row :gutter="20" align="middle">
        <el-col :span="16">
          <el-input
            v-model="newDownloadUrl"
            placeholder="请输入下载链接..."
            clearable
            size="large"
          >
            <template #prepend>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
        </el-col>
        <el-col :span="8">
          <el-button
            type="primary"
            size="large"
            @click="handleAddDownload"
            :loading="addingDownload"
            style="width: 100%;"
          >
            <el-icon><Plus /></el-icon>
            添加下载
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 统计信息 -->
    <el-row :gutter="20" class="mb-20">
      <el-col :span="24" :sm="12" :lg="4" v-for="(stat, key) in statistics" :key="key">
        <el-card class="stat-card">
          <el-statistic
            :title="getStatTitle(key)"
            :value="stat"
            :value-style="getStatStyle(key)"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 下载任务列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><List /></el-icon>
          <span>下载任务</span>
          <el-button-group style="margin-left: auto;">
            <el-button size="small" @click="refreshTasks" :loading="loading">
              刷新
            </el-button>
            <el-button size="small" @click="clearCompleted">
              清理已完成
            </el-button>
          </el-button-group>
        </div>
      </template>

      <div class="download-list">
        <div
          v-for="task in sortedTasks"
          :key="task.id"
          class="download-item"
          :class="{ 'download-active': task.status === 'downloading' }"
        >
          <!-- 任务信息 -->
          <div class="task-info">
            <div class="task-header">
              <el-icon class="file-icon">
                <Document />
              </el-icon>
              <div class="task-details">
                <div class="task-name">{{ task.name }}</div>
                <div class="task-url">{{ task.url }}</div>
              </div>
              <el-tag
                :type="getStatusType(task.status)"
                size="small"
                class="task-status"
              >
                {{ getStatusText(task.status) }}
              </el-tag>
            </div>

            <!-- 进度信息 -->
            <div class="task-progress">
              <el-progress
                :percentage="task.progress"
                :status="getProgressStatus(task.status)"
                :show-text="false"
                :stroke-width="8"
                class="progress-bar"
              />
              <div class="progress-info">
                <span class="progress-text">{{ task.progress }}%</span>
                <span class="size-info">
                  {{ formatSize(task.downloadedSize) }} / {{ formatSize(task.size) }}
                </span>
                <span v-if="task.speed > 0" class="speed-info">
                  {{ formatSpeed(task.speed) }}
                </span>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="task-actions">
              <el-button
                v-if="task.status === 'pending' || task.status === 'paused'"
                type="success"
                size="small"
                @click="handleStartDownload(task.id)"
              >
                <el-icon><VideoPlay /></el-icon>
                开始
              </el-button>
              
              <el-button
                v-if="task.status === 'downloading'"
                type="warning"
                size="small"
                @click="handlePauseDownload(task.id)"
              >
                <el-icon><VideoPause /></el-icon>
                暂停
              </el-button>
              
              <el-button
                v-if="task.status === 'completed'"
                type="primary"
                size="small"
                @click="handleOpenFile(task)"
              >
                <el-icon><FolderOpened /></el-icon>
                打开
              </el-button>
              
              <el-button
                type="danger"
                size="small"
                @click="handleRemoveDownload(task.id)"
              >
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>

            <!-- 时间信息 -->
            <div class="task-time">
              <span class="time-label">创建:</span>
              <span class="time-value">{{ formatTime(task.createdAt) }}</span>
              <span class="time-label">更新:</span>
              <span class="time-value">{{ formatTime(task.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <el-empty v-if="tasks.length === 0" description="暂无下载任务" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '@/api/request'
import { wsManager } from '@/core/WebSocketManager'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Link,
  Plus,
  List,
  Document,
  VideoPlay,
  VideoPause,
  FolderOpened,
  Delete
} from '@element-plus/icons-vue'

// 插件配置
defineOptions({
  name: 'DownloadManager',
  route: {
    path: '/plugins/download-manager',
    name: 'plugin-download-manager'
  },
  menu: {
    title: '下载管理',
    icon: 'Download',
    order: 2
  }
})

// 初始化用户 store
const userStore = useUserStore()

interface DownloadTask {
  id: string
  name: string
  url: string
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused'
  progress: number
  size: number
  downloadedSize: number
  speed: number
  createdAt: number
  updatedAt: number
  filePath?: string
  error?: string
}

// 状态
const loading = ref(false)
const addingDownload = ref(false)
const newDownloadUrl = ref('')

// 数据
const tasks = ref<DownloadTask[]>([])
const statistics = ref({
  total: 0,
  pending: 0,
  downloading: 0,
  completed: 0,
  failed: 0,
  paused: 0
})

// 计算属性
const sortedTasks = computed(() => {
  return [...tasks.value].sort((a, b) => {
    // 下载中的任务优先显示
    if (a.status === 'downloading' && b.status !== 'downloading') return -1
    if (b.status === 'downloading' && a.status !== 'downloading') return 1
    // 按更新时间排序
    return b.updatedAt - a.updatedAt
  })
})

// 方法
const refreshTasks = async () => {
  loading.value = true
  try {
    const response = await api.get('/plugins/download-manager/tasks')
    tasks.value = response.data.tasks
    statistics.value = response.data.statistics
  } catch (error) {
    ElMessage.error('获取下载任务失败')
  } finally {
    loading.value = false
  }
}

const handleAddDownload = async () => {
  if (!newDownloadUrl.value.trim()) {
    ElMessage.warning('请输入下载链接')
    return
  }

  addingDownload.value = true
  try {
    await api.post('/plugins/download-manager/add', {
      url: newDownloadUrl.value.trim(),
      userId: userStore.user?.id
    })
    newDownloadUrl.value = ''
    ElMessage.success('下载任务添加成功')
    await refreshTasks()
  } catch (error) {
    ElMessage.error('添加下载任务失败')
  } finally {
    addingDownload.value = false
  }
}

const handleStartDownload = async (id: string) => {
  try {
    await api.post(`/plugins/download-manager/start/${id}`)
    ElMessage.success('下载已开始')
    await refreshTasks()
  } catch (error) {
    ElMessage.error('启动下载失败')
  }
}

const handlePauseDownload = async (id: string) => {
  try {
    await api.post(`/plugins/download-manager/pause/${id}`)
    ElMessage.success('下载已暂停')
    await refreshTasks()
  } catch (error) {
    ElMessage.error('暂停下载失败')
  }
}

const handleRemoveDownload = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除此下载任务吗？', '删除确认', {
      type: 'warning'
    })
    
    await api.delete(`/plugins/download-manager/remove/${id}`)
    ElMessage.success('下载任务已删除')
    await refreshTasks()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除下载任务失败')
    }
  }
}

const handleOpenFile = (task: DownloadTask) => {
  ElMessage.info(`文件路径: ${task.filePath}`)
}

const clearCompleted = async () => {
  const completedTasks = tasks.value.filter(t => t.status === 'completed')
  if (completedTasks.length === 0) {
    ElMessage.info('没有已完成的任务')
    return
  }

  try {
    await ElMessageBox.confirm(`确定要清理 ${completedTasks.length} 个已完成的任务吗？`, '清理确认', {
      type: 'warning'
    })
    
    for (const task of completedTasks) {
      await api.delete(`/plugins/download-manager/remove/${task.id}`)
    }
    
    ElMessage.success(`已清理 ${completedTasks.length} 个任务`)
    await refreshTasks()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理任务失败')
    }
  }
}

// 工具函数
const getStatusType = (status: string) => {
  const types: Record<string, string> = {
    pending: 'info',
    downloading: 'warning',
    completed: 'success',
    failed: 'danger',
    paused: 'info'
  }
  return types[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '等待中',
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
    paused: '已暂停'
  }
  return texts[status] || status
}

const getProgressStatus = (status: string) => {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'exception'
  return undefined
}

const getStatTitle = (key: string) => {
  const titles: Record<string, string> = {
    total: '总任务',
    pending: '等待中',
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
    paused: '已暂停'
  }
  return titles[key] || key
}

const getStatStyle = (key: string) => {
  const colors: Record<string, string> = {
    total: '#409eff',
    downloading: '#e6a23c',
    completed: '#67c23a',
    failed: '#f56c6c'
  }
  return { color: colors[key] || '#409eff' }
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatSpeed = (bytesPerSecond: number) => {
  return formatSize(bytesPerSecond) + '/s'
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

// WebSocket 事件处理
const handleDownloadEvent = (payload: any) => {
  // 实时更新任务状态
  refreshTasks()
}

// 生命周期
onMounted(() => {
  refreshTasks()
  
  // 订阅下载事件
  wsManager.on('download:added', handleDownloadEvent)
  wsManager.on('download:started', handleDownloadEvent)
  wsManager.on('download:progress', handleDownloadEvent)
  wsManager.on('download:completed', handleDownloadEvent)
  wsManager.on('download:paused', handleDownloadEvent)
  wsManager.on('download:removed', handleDownloadEvent)
  
  // 定期刷新
  const intervalId = setInterval(refreshTasks, 5000)
  
  onUnmounted(() => {
    clearInterval(intervalId)
    wsManager.off('download:added', handleDownloadEvent)
    wsManager.off('download:started', handleDownloadEvent)
    wsManager.off('download:progress', handleDownloadEvent)
    wsManager.off('download:completed', handleDownloadEvent)
    wsManager.off('download:paused', handleDownloadEvent)
    wsManager.off('download:removed', handleDownloadEvent)
  })
})
</script>

<style scoped>
.download-manager {
  max-width: 1200px;
}

.mb-20 {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-card {
  text-align: center;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.download-list {
  max-height: 600px;
  overflow-y: auto;
}

.download-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background-color: #fafafa;
  transition: all 0.3s ease;
}

.download-item:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.download-active {
  border-color: #409eff;
  background-color: #f0f9ff;
}

.task-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  font-size: 24px;
  color: #409eff;
}

.task-details {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-url {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status {
  flex-shrink: 0;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #606266;
  min-width: 200px;
}

.progress-text {
  font-weight: 500;
  color: #409eff;
}

.speed-info {
  color: #67c23a;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.task-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #c0c4cc;
}

.time-label {
  font-weight: 500;
}

.time-value {
  margin-right: 16px;
}

@media (max-width: 768px) {
  .task-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .progress-info {
    flex-direction: column;
    align-items: flex-start;
    min-width: auto;
  }
  
  .task-actions {
    flex-wrap: wrap;
  }
}
</style>