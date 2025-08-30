<template>
  <div class="settings">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </div>
      </template>
      
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="基础设置" name="basic">
          <el-form :model="basicSettings" label-width="120px">
            <el-form-item label="系统名称">
              <el-input v-model="basicSettings.systemName" />
            </el-form-item>
            
            <el-form-item label="主题">
              <el-select v-model="basicSettings.theme">
                <el-option label="浅色主题" value="light" />
                <el-option label="深色主题" value="dark" />
                <el-option label="自动" value="auto" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="语言">
              <el-select v-model="basicSettings.language">
                <el-option label="中文" value="zh-CN" />
                <el-option label="English" value="en-US" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="自动刷新">
              <el-switch v-model="basicSettings.autoRefresh" />
              <span class="form-help">自动刷新系统状态和数据</span>
            </el-form-item>
            
            <el-form-item label="刷新间隔">
              <el-input-number
                v-model="basicSettings.refreshInterval"
                :min="5"
                :max="300"
                :step="5"
                :disabled="!basicSettings.autoRefresh"
              />
              <span class="form-help">秒</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="服务配置" name="server">
          <el-form :model="serverSettings" label-width="120px">
            <el-form-item label="服务端口">
              <el-input-number
                v-model="serverSettings.port"
                :min="1000"
                :max="65535"
              />
            </el-form-item>
            
            <el-form-item label="CORS 配置">
              <el-switch v-model="serverSettings.corsEnabled" />
              <span class="form-help">启用跨域资源共享</span>
            </el-form-item>
            
            <el-form-item label="日志级别">
              <el-select v-model="serverSettings.logLevel">
                <el-option label="错误" value="error" />
                <el-option label="警告" value="warn" />
                <el-option label="信息" value="info" />
                <el-option label="调试" value="debug" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="最大请求大小">
              <el-input-number
                v-model="serverSettings.maxRequestSize"
                :min="1"
                :max="100"
              />
              <span class="form-help">MB</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="插件配置" name="plugins">
          <el-form :model="pluginSettings" label-width="120px">
            <el-form-item label="自动加载插件">
              <el-switch v-model="pluginSettings.autoLoad" />
              <span class="form-help">启动时自动加载所有插件</span>
            </el-form-item>
            
            <el-form-item label="插件目录">
              <el-input v-model="pluginSettings.directory" />
              <span class="form-help">插件文件存放目录</span>
            </el-form-item>
            
            <el-form-item label="插件缓存">
              <el-switch v-model="pluginSettings.enableCache" />
              <span class="form-help">缓存插件加载结果</span>
            </el-form-item>
            
            <el-form-item label="热重载">
              <el-switch v-model="pluginSettings.hotReload" />
              <span class="form-help">开发模式下支持热重载</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="安全设置" name="security">
          <el-form :model="securitySettings" label-width="120px">
            <el-form-item label="启用认证">
              <el-switch v-model="securitySettings.authEnabled" />
            </el-form-item>
            
            <el-form-item label="会话超时">
              <el-input-number
                v-model="securitySettings.sessionTimeout"
                :min="5"
                :max="1440"
                :disabled="!securitySettings.authEnabled"
              />
              <span class="form-help">分钟</span>
            </el-form-item>
            
            <el-form-item label="API 限流">
              <el-switch v-model="securitySettings.rateLimitEnabled" />
            </el-form-item>
            
            <el-form-item label="请求频率限制">
              <el-input-number
                v-model="securitySettings.rateLimit"
                :min="10"
                :max="1000"
                :disabled="!securitySettings.rateLimitEnabled"
              />
              <span class="form-help">次/分钟</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      
      <div class="settings-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          保存设置
        </el-button>
      </div>
    </el-card>
    
    <!-- 系统信息卡片 -->
    <el-card class="mt-20">
      <template #header>
        <div class="card-header">
          <el-icon><InfoFilled /></el-icon>
          <span>系统信息</span>
        </div>
      </template>
      
      <el-descriptions :column="2" border>
        <el-descriptions-item label="系统版本">
          v1.0.0
        </el-descriptions-item>
        <el-descriptions-item label="构建时间">
          {{ buildTime }}
        </el-descriptions-item>
        <el-descriptions-item label="Node.js 版本">
          {{ systemInfo?.nodeVersion || 'Unknown' }}
        </el-descriptions-item>
        <el-descriptions-item label="运行平台">
          {{ systemInfo?.platform }} {{ systemInfo?.arch }}
        </el-descriptions-item>
        <el-descriptions-item label="运行时间">
          {{ formatUptime(systemInfo?.uptime) }}
        </el-descriptions-item>
        <el-descriptions-item label="内存使用">
          {{ formatMemory(systemInfo?.memory.heapUsed) }} / {{ formatMemory(systemInfo?.memory.heapTotal) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { ElMessage } from 'element-plus'
import { Setting, InfoFilled } from '@element-plus/icons-vue'

const systemStore = useSystemStore()
const activeTab = ref('basic')
const saving = ref(false)
const buildTime = new Date().toLocaleString()

// 设置数据
const basicSettings = ref({
  systemName: 'NAS服务',
  theme: 'light',
  language: 'zh-CN',
  autoRefresh: true,
  refreshInterval: 30
})

const serverSettings = ref({
  port: 3000,
  corsEnabled: true,
  logLevel: 'info',
  maxRequestSize: 10
})

const pluginSettings = ref({
  autoLoad: true,
  directory: '/plugins',
  enableCache: true,
  hotReload: false
})

const securitySettings = ref({
  authEnabled: false,
  sessionTimeout: 120,
  rateLimitEnabled: true,
  rateLimit: 100
})

// 计算属性
const systemInfo = computed(() => systemStore.systemInfo)

// 方法
const handleSave = async () => {
  saving.value = true
  try {
    // TODO: 保存设置到服务器
    await new Promise(resolve => setTimeout(resolve, 1000))
    ElMessage.success('设置保存成功')
  } catch (error) {
    ElMessage.error('设置保存失败')
  } finally {
    saving.value = false
  }
}

const handleReset = () => {
  // 重置设置到默认值
  basicSettings.value = {
    systemName: 'NAS服务',
    theme: 'light',
    language: 'zh-CN',
    autoRefresh: true,
    refreshInterval: 30
  }
  
  serverSettings.value = {
    port: 3000,
    corsEnabled: true,
    logLevel: 'info',
    maxRequestSize: 10
  }
  
  pluginSettings.value = {
    autoLoad: true,
    directory: '/plugins',
    enableCache: true,
    hotReload: false
  }
  
  securitySettings.value = {
    authEnabled: false,
    sessionTimeout: 120,
    rateLimitEnabled: true,
    rateLimit: 100
  }
  
  ElMessage.info('设置已重置')
}

const formatUptime = (seconds?: number) => {
  if (!seconds) return 'Unknown'
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

const formatMemory = (bytes?: number) => {
  if (!bytes) return 'Unknown'
  const mb = (bytes / 1024 / 1024).toFixed(1)
  return `${mb}MB`
}

// 生命周期
onMounted(() => {
  // 加载当前设置
  // TODO: 从服务器加载设置
})
</script>

<style scoped>
.settings {
  max-width: 800px;
}

.mt-20 {
  margin-top: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-help {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

:deep(.el-tabs__content) {
  padding: 20px;
}
</style>