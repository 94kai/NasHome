<template>
  <div class="disk-space-container">
    <div class="disk-space-header">
      <h1>磁盘空间监控</h1>
      <div class="header-actions">
        <button @click="refreshData" :disabled="isLoading" class="refresh-button">
          <el-icon v-if="isLoading" class="is-loading">
            <Loading />
          </el-icon>
          <el-icon v-else>
            <Refresh />
          </el-icon>
          {{ isLoading ? '刷新中...' : '刷新' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      <el-alert
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />
    </div>

    <!-- 主要磁盘概览 -->
    <div v-if="mainDisk" class="main-disk-card">
      <div class="card-header">
        <h2>主要磁盘</h2>
        <span class="mount-path">{{ mainDisk.mount }}</span>
      </div>

      <div class="disk-overview">
        <div class="disk-info">
          <div class="info-item">
            <span class="label">总容量</span>
            <span class="value">{{ formatBytes(mainDisk.total) }}</span>
          </div>
          <div class="info-item">
            <span class="label">已使用</span>
            <span class="value">{{ formatBytes(mainDisk.used) }}</span>
          </div>
          <div class="info-item">
            <span class="label">可用空间</span>
            <span class="value">{{ formatBytes(mainDisk.available) }}</span>
          </div>
          <div class="info-item">
            <span class="label">使用率</span>
            <span class="value" :class="getUsageClass(mainDisk.usePercent)">
              {{ mainDisk.usePercent }}%
            </span>
          </div>
        </div>

        <div class="progress-section">
          <div class="progress-label">
            <span>使用情况</span>
            <span>{{ formatBytes(mainDisk.used) }} / {{ formatBytes(mainDisk.total) }}</span>
          </div>
          <el-progress
            :percentage="mainDisk.usePercent"
            :color="getProgressColor(mainDisk.usePercent)"
            :stroke-width="12"
            :show-text="false"
          />
        </div>
      </div>
    </div>

    <!-- 所有磁盘列表 -->
    <div v-if="disks.length > 0" class="disks-list">
      <h2>所有磁盘分区</h2>
      <div class="disks-grid">
        <div
          v-for="disk in disks"
          :key="disk.mount"
          class="disk-card"
          :class="{ 'main-disk': disk.mount === mainDisk?.mount }"
        >
          <div class="disk-card-header">
            <h3>{{ disk.mount }}</h3>
            <span class="usage-badge" :class="getUsageClass(disk.usePercent)">
              {{ disk.usePercent }}%
            </span>
          </div>

          <div class="disk-details">
            <div class="size-info">
              <div class="size-bar">
                <div
                  class="used-bar"
                  :style="{ width: `${disk.usePercent}%` }"
                  :class="getUsageClass(disk.usePercent)"
                ></div>
              </div>
              <div class="size-text">
                <span>{{ formatBytes(disk.available) }} 可用</span>
                <span>{{ formatBytes(disk.total) }} 总共</span>
              </div>
            </div>

            <div class="disk-stats">
              <div class="stat">
                <span class="stat-label">已使用</span>
                <span class="stat-value">{{ formatBytes(disk.used) }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">可用</span>
                <span class="stat-value">{{ formatBytes(disk.available) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!isLoading && !error" class="empty-state">
      <el-empty
        description="无法获取磁盘信息"
        :image-size="80"
      >
        <template #image>
          <el-icon size="80" class="empty-icon">
            <Warning />
          </el-icon>
        </template>
      </el-empty>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading && disks.length === 0" class="loading-state">
      <el-skeleton
        :loading="isLoading"
        animated
        :count="3"
        :rows="4"
        :throttle="500"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Loading, Warning } from '@element-plus/icons-vue'
import { diskSpaceApi } from '@/api/disk-space'

// 类型定义
interface DiskInfo {
  mount: string
  total: number
  used: number
  available: number
  usePercent: number
}

// 响应式数据
const disks = ref<DiskInfo[]>([])
const mainDisk = ref<DiskInfo | null>(null)
const isLoading = ref(false)
const error = ref<string>('')

// 计算属性
const mainDiskData = computed(() => {
  if (!disks.value.length) return null
  return disks.value.reduce((max, current) =>
    current.total > max.total ? current : max
  )
})

// 方法
const fetchDiskData = async () => {
  try {
    isLoading.value = true
    error.value = ''

    const response = await diskSpaceApi.getDiskSpace()
    if (response.data && response.data.success) {
      disks.value = response.data.data || []
      mainDisk.value = mainDiskData.value
    } else {
      throw new Error((response.data?.message) || '获取磁盘信息失败')
    }
  } catch (err: any) {
    console.error('Failed to fetch disk data:', err)
    error.value = err.message || '获取磁盘信息失败'
    ElMessage.error(error.value)
  } finally {
    isLoading.value = false
  }
}

const refreshData = () => {
  fetchDiskData()
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getUsageClass = (percent: number): string => {
  if (percent >= 90) return 'danger'
  if (percent >= 75) return 'warning'
  return 'normal'
}

const getProgressColor = (percent: number): string => {
  if (percent >= 90) return '#f56c6c'
  if (percent >= 75) return '#e6a23c'
  return '#67c23a'
}

// 生命周期
onMounted(() => {
  fetchDiskData()
})
</script>

<style scoped>
.disk-space-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.disk-space-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e4e7ed;
}

.disk-space-header h1 {
  margin: 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.refresh-button:hover:not(:disabled) {
  border-color: #c0c4cc;
  background: #f5f7fa;
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-bottom: 20px;
}

.main-disk-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
  overflow: hidden;
}

.card-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  margin: 0;
  color: #303133;
  font-size: 18px;
  font-weight: 600;
}

.mount-path {
  color: #909399;
  font-size: 14px;
  font-family: monospace;
}

.disk-overview {
  padding: 24px;
}

.disk-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  color: #909399;
  font-size: 14px;
}

.info-item .value {
  color: #303133;
  font-size: 18px;
  font-weight: 600;
}

.info-item .value.danger {
  color: #f56c6c;
}

.info-item .value.warning {
  color: #e6a23c;
}

.info-item .value.normal {
  color: #67c23a;
}

.progress-section {
  margin-top: 20px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: #606266;
}

.disks-list h2 {
  margin: 0 0 16px 0;
  color: #303133;
  font-size: 18px;
  font-weight: 600;
}

.disks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.disk-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 20px;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.disk-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.disk-card.main-disk {
  border-color: #409eff;
  background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
}

.disk-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.disk-card-header h3 {
  margin: 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  font-family: monospace;
}

.usage-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.usage-badge.danger {
  background: #f56c6c;
}

.usage-badge.warning {
  background: #e6a23c;
}

.usage-badge.normal {
  background: #67c23a;
}

.disk-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.size-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.size-bar {
  height: 8px;
  background: #f0f2f5;
  border-radius: 4px;
  overflow: hidden;
}

.used-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.used-bar.danger {
  background: #f56c6c;
}

.used-bar.warning {
  background: #e6a23c;
}

.used-bar.normal {
  background: #67c23a;
}

.size-text {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}

.disk-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  color: #909399;
  font-size: 12px;
}

.stat-value {
  color: #303133;
  font-size: 14px;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  color: #c0c4cc;
}

.loading-state {
  padding: 20px;
}

@media (max-width: 768px) {
  .disk-space-container {
    padding: 16px;
  }

  .disk-space-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .header-actions {
    justify-content: center;
  }

  .disks-grid {
    grid-template-columns: 1fr;
  }

  .disk-info {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .disk-stats {
    grid-template-columns: 1fr;
  }
}
</style>
