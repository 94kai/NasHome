<template>
  <div class="plugin-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><Grid /></el-icon>
          <span>插件管理</span>
          <el-button
            type="primary"
            size="small"
            @click="handleRefresh"
            :loading="loading"
            style="margin-left: auto;"
          >
            刷新
          </el-button>
        </div>
      </template>
      
      <div class="plugin-grid">
        <div
          v-for="(pluginInfo, name) in plugins"
          :key="name"
          class="plugin-card"
          :class="{ 'plugin-enabled': pluginInfo.enabled }"
        >
          <div class="plugin-header">
            <div class="plugin-title">
              <h3>{{ pluginInfo.name }}</h3>
              <el-tag
                :type="pluginInfo.enabled ? 'success' : 'info'"
                size="small"
              >
                {{ pluginInfo.enabled ? '已启用' : '已禁用' }}
              </el-tag>
            </div>
            
            <el-switch
              v-model="pluginInfo.enabled"
              @change="(value: boolean) => handleToggle(name, value)"
              :disabled="!pluginInfo.installed"
            />
          </div>
          
          <div class="plugin-content">
            <p class="plugin-description">
              {{ pluginInfo.description || '暂无描述' }}
            </p>
            
            <div class="plugin-meta">
              <div class="meta-item">
                <span class="meta-label">版本:</span>
                <span class="meta-value">v{{ pluginInfo.version }}</span>
              </div>
              
              <div v-if="pluginInfo.author" class="meta-item">
                <span class="meta-label">作者:</span>
                <span class="meta-value">{{ pluginInfo.author }}</span>
              </div>
              
              <div class="meta-item">
                <span class="meta-label">状态:</span>
                <el-tag
                  :type="pluginInfo.installed ? 'success' : 'warning'"
                  size="mini"
                >
                  {{ pluginInfo.installed ? '已安装' : '未安装' }}
                </el-tag>
              </div>
              
              <div class="meta-item">
                <span class="meta-label">安装时间:</span>
                <span class="meta-value">
                  {{ formatTime(pluginInfo.installTime) }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="plugin-actions">
            <el-button
              v-if="pluginInfo.enabled"
              size="small"
              type="primary"
              @click="handleViewPlugin(name)"
            >
              查看详情
            </el-button>
            
            <el-button
              size="small"
              type="info"
              @click="handleConfigPlugin(name)"
            >
              配置
            </el-button>
          </div>
        </div>
      </div>
      
      <el-empty v-if="Object.keys(plugins).length === 0" description="暂无插件" />
    </el-card>

    <!-- 插件详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`插件详情 - ${selectedPlugin?.name}`"
      width="600px"
    >
      <div v-if="selectedPlugin" class="plugin-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="插件名称">
            {{ selectedPlugin.name }}
          </el-descriptions-item>
          <el-descriptions-item label="版本">
            v{{ selectedPlugin.version }}
          </el-descriptions-item>
          <el-descriptions-item label="描述">
            {{ selectedPlugin.description || '暂无描述' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="selectedPlugin.author" label="作者">
            {{ selectedPlugin.author }}
          </el-descriptions-item>
          <el-descriptions-item label="安装状态">
            <el-tag :type="selectedPlugin.installed ? 'success' : 'warning'">
              {{ selectedPlugin.installed ? '已安装' : '未安装' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="启用状态">
            <el-tag :type="selectedPlugin.enabled ? 'success' : 'info'">
              {{ selectedPlugin.enabled ? '已启用' : '已禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="安装时间">
            {{ formatTime(selectedPlugin.installTime) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <!-- 插件配置对话框 -->
    <el-dialog
      v-model="configDialogVisible"
      :title="`插件配置 - ${selectedPlugin?.name}`"
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="自动启动">
          <el-switch v-model="pluginConfig.autoStart" />
        </el-form-item>
        <el-form-item label="日志级别">
          <el-select v-model="pluginConfig.logLevel">
            <el-option label="错误" value="error" />
            <el-option label="警告" value="warn" />
            <el-option label="信息" value="info" />
            <el-option label="调试" value="debug" />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Grid } from '@element-plus/icons-vue'
import type { PluginInfo } from '@/types'

const systemStore = useSystemStore()
const loading = ref(false)
const detailDialogVisible = ref(false)
const configDialogVisible = ref(false)
const selectedPlugin = ref<PluginInfo | null>(null)
const pluginConfig = ref({
  autoStart: true,
  logLevel: 'info'
})

// 计算属性
const plugins = computed(() => systemStore.plugins)

// 方法
const handleRefresh = async () => {
  loading.value = true
  try {
    await systemStore.initialize()
    ElMessage.success('刷新成功')
  } catch (error) {
    ElMessage.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const handleToggle = async (pluginName: string, enabled: boolean) => {
  try {
    const success = await systemStore.togglePlugin(pluginName, enabled)
    if (success) {
      ElMessage.success(`插件${enabled ? '启用' : '禁用'}成功`)
    } else {
      // 还原状态
      systemStore.plugins[pluginName].enabled = !enabled
    }
  } catch (error) {
    // 还原状态
    systemStore.plugins[pluginName].enabled = !enabled
    ElMessage.error(`插件${enabled ? '启用' : '禁用'}失败`)
  }
}

const handleViewPlugin = (pluginName: string) => {
  selectedPlugin.value = plugins.value[pluginName]
  detailDialogVisible.value = true
}

const handleConfigPlugin = (pluginName: string) => {
  selectedPlugin.value = plugins.value[pluginName]
  
  // TODO: 从服务器加载插件配置
  pluginConfig.value = {
    autoStart: true,
    logLevel: 'info'
  }
  
  configDialogVisible.value = true
}

const handleSaveConfig = async () => {
  try {
    // TODO: 保存插件配置到服务器
    ElMessage.success('配置保存成功')
    configDialogVisible.value = false
  } catch (error) {
    ElMessage.error('配置保存失败')
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

// 生命周期
onMounted(() => {
  handleRefresh()
})
</script>

<style scoped>
.plugin-manager {
  max-width: 1200px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 16px;
}

.plugin-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 20px;
  background-color: #fafafa;
  transition: all 0.3s ease;
}

.plugin-card:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.plugin-enabled {
  border-color: #67c23a;
  background-color: #f0f9ff;
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.plugin-title {
  flex: 1;
}

.plugin-title h3 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 18px;
  font-weight: 500;
}

.plugin-content {
  margin-bottom: 16px;
}

.plugin-description {
  color: #606266;
  line-height: 1.5;
  margin: 0 0 12px 0;
  min-height: 48px;
}

.plugin-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 12px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  color: #909399;
  font-weight: 500;
}

.meta-value {
  color: #303133;
}

.plugin-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.plugin-detail {
  margin-top: 16px;
}
</style>