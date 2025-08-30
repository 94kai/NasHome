<template>
  <div class="network-status">
    <el-row :gutter="20">
      <!-- 网络概览 -->
      <el-col :span="24" :lg="12">
        <el-card class="overview-card">
          <template #header>
            <div class="card-header">
              <el-icon><Connection /></el-icon>
              <span>网络概览</span>
              <el-button
                size="small"
                @click="refreshNetworkInfo"
                :loading="loading"
                style="margin-left: auto;"
              >
                刷新
              </el-button>
            </div>
          </template>
          
          <div v-if="networkInfo">
            <div class="stats-grid">
              <div class="stat-item">
                <el-statistic title="网络接口" :value="networkInfo.statistics.totalInterfaces" />
              </div>
              <div class="stat-item">
                <el-statistic title="活跃接口" :value="networkInfo.statistics.activeInterfaces" />
              </div>
              <div class="stat-item">
                <el-statistic title="IPv4 地址" :value="networkInfo.statistics.ipv4Addresses" />
              </div>
              <div class="stat-item">
                <el-statistic title="IPv6 地址" :value="networkInfo.statistics.ipv6Addresses" />
              </div>
            </div>
          </div>
          
          <el-skeleton v-else :rows="2" animated />
        </el-card>
      </el-col>
      
      <!-- 连通性测试 -->
      <el-col :span="24" :lg="12">
        <el-card class="connectivity-card">
          <template #header>
            <div class="card-header">
              <el-icon><Link /></el-icon>
              <span>连通性测试</span>
              <el-button
                size="small"
                @click="testConnectivity"
                :loading="connectivityLoading"
                style="margin-left: auto;"
              >
                测试
              </el-button>
            </div>
          </template>
          
          <div v-if="connectivity" class="connectivity-results">
            <div
              v-for="result in connectivity.results"
              :key="result.host"
              class="connectivity-item"
            >
              <div class="connectivity-info">
                <span class="target-name">{{ result.name }}</span>
                <span class="target-host">{{ result.host }}</span>
              </div>
              
              <div class="connectivity-status">
                <el-tag
                  :type="result.status === 'success' ? 'success' : 'danger'"
                  size="small"
                >
                  {{ result.status === 'success' ? '正常' : '失败' }}
                </el-tag>
                <span v-if="result.latency" class="latency">
                  {{ result.latency }}ms
                </span>
              </div>
            </div>
          </div>
          
          <el-empty v-else description="点击测试按钮检查连通性" />
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 网络接口详情 -->
    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><Monitor /></el-icon>
              <span>网络接口详情</span>
            </div>
          </template>
          
          <el-table
            v-if="networkInfo"
            :data="networkInfo.interfaces"
            style="width: 100%"
            empty-text="暂无网络接口"
          >
            <el-table-column prop="name" label="接口名称" width="120" />
            <el-table-column label="地址信息">
              <template #default="{ row }">
                <div class="address-list">
                  <div
                    v-for="(addr, index) in row.addresses"
                    :key="index"
                    class="address-item"
                  >
                    <el-tag
                      :type="addr.internal ? 'info' : 'success'"
                      size="small"
                    >
                      {{ addr.family }}
                    </el-tag>
                    <span class="address">{{ addr.address }}</span>
                    <span v-if="addr.cidr" class="cidr">{{ addr.cidr }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="MAC 地址" width="160">
              <template #default="{ row }">
                <span class="mac-address">
                  {{ row.addresses[0]?.mac || 'N/A' }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 速度测试 -->
    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><Lightning /></el-icon>
              <span>网络速度测试</span>
              <el-button
                type="primary"
                size="small"
                @click="runSpeedTest"
                :loading="speedTestLoading"
                style="margin-left: auto;"
              >
                {{ speedTestLoading ? '测试中...' : '开始测试' }}
              </el-button>
            </div>
          </template>
          
          <div v-if="speedTestResult" class="speed-test-result">
            <el-row :gutter="20">
              <el-col :span="6">
                <div class="speed-metric">
                  <div class="metric-value">
                    {{ speedTestResult.download.toFixed(1) }}
                  </div>
                  <div class="metric-label">下载速度 (Mbps)</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="speed-metric">
                  <div class="metric-value">
                    {{ speedTestResult.upload.toFixed(1) }}
                  </div>
                  <div class="metric-label">上传速度 (Mbps)</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="speed-metric">
                  <div class="metric-value">
                    {{ speedTestResult.ping.toFixed(1) }}
                  </div>
                  <div class="metric-label">延迟 (ms)</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="speed-metric">
                  <div class="metric-value">
                    {{ speedTestResult.jitter.toFixed(1) }}
                  </div>
                  <div class="metric-label">抖动 (ms)</div>
                </div>
              </el-col>
            </el-row>
            
            <div class="test-time">
              测试时间: {{ formatTime(speedTestResult.timestamp) }}
            </div>
          </div>
          
          <el-empty v-else description="点击开始测试按钮进行网络速度测试" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api/request'
import { ElMessage } from 'element-plus'
import {
  Connection,
  Link,
  Monitor,
  Lightning
} from '@element-plus/icons-vue'

// 插件配置
defineOptions({
  name: 'NetworkStatus',
  route: {
    path: '/plugins/network-status',
    name: 'plugin-network-status'
  },
  menu: {
    title: '网络状态',
    icon: 'Connection',
    order: 1
  }
})

// 状态
const loading = ref(false)
const connectivityLoading = ref(false)
const speedTestLoading = ref(false)

// 数据
const networkInfo = ref<any>(null)
const connectivity = ref<any>(null)
const speedTestResult = ref<any>(null)

// 方法
const refreshNetworkInfo = async () => {
  loading.value = true
  try {
    const response = await api.get('/plugins/network-status/status')
    networkInfo.value = response.data
  } catch (error) {
    ElMessage.error('获取网络信息失败')
  } finally {
    loading.value = false
  }
}

const testConnectivity = async () => {
  connectivityLoading.value = true
  try {
    const response = await api.get('/plugins/network-status/connectivity')
    connectivity.value = response.data
    
    const successCount = response.data.results.filter((r: any) => r.status === 'success').length
    ElMessage.success(`连通性测试完成，${successCount}/${response.data.results.length} 个目标可达`)
  } catch (error) {
    ElMessage.error('连通性测试失败')
  } finally {
    connectivityLoading.value = false
  }
}

const runSpeedTest = async () => {
  speedTestLoading.value = true
  try {
    ElMessage.info('网络速度测试开始，请等待...')
    const response = await api.get('/plugins/network-status/speed-test')
    speedTestResult.value = response.data
    ElMessage.success('网络速度测试完成')
  } catch (error) {
    ElMessage.error('网络速度测试失败')
  } finally {
    speedTestLoading.value = false
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

// 生命周期
onMounted(() => {
  refreshNetworkInfo()
})
</script>

<style scoped>
.network-status {
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

.overview-card,
.connectivity-card {
  height: 250px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  height: 160px;
  align-items: center;
}

.stat-item {
  text-align: center;
}

.connectivity-results {
  max-height: 160px;
  overflow-y: auto;
}

.connectivity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.connectivity-info {
  flex: 1;
}

.target-name {
  font-weight: 500;
  margin-right: 8px;
}

.target-host {
  color: #909399;
  font-size: 12px;
}

.connectivity-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.latency {
  font-size: 12px;
  color: #67c23a;
}

.address-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.address-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.address {
  font-family: monospace;
  font-size: 14px;
}

.cidr {
  color: #909399;
  font-size: 12px;
}

.mac-address {
  font-family: monospace;
  color: #606266;
}

.speed-test-result {
  text-align: center;
}

.speed-metric {
  padding: 20px;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.metric-value {
  font-size: 32px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 14px;
  color: #909399;
}

.test-time {
  margin-top: 20px;
  font-size: 12px;
  color: #909399;
}
</style>