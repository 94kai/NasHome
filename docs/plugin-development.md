# 插件开发指南

## 概述

NAS 服务脚手架提供了一个强大的插件系统，允许开发者轻松扩展系统功能。插件系统支持前后端分离的架构，每个插件都可以独立开发、部署和管理。

## 插件架构

### 后端插件结构

后端插件必须实现 `IPlugin` 接口：

```typescript
interface IPlugin {
  name: string                    // 插件名称（唯一标识）
  version: string                 // 插件版本
  description: string             // 插件描述
  author?: string                 // 作者信息
  dependencies?: string[]         // 依赖的其他插件
  
  // 生命周期方法
  install(app: FastifyInstance): Promise<void>
  uninstall?(app: FastifyInstance): Promise<void>
  
  // 路由配置
  routes?: PluginRoute[]
  
  // 前端配置
  frontend?: {
    component: string
    menu?: MenuConfig
    assets?: string[]
  }
}
```

### 前端插件结构

前端插件需要提供：

```typescript
interface PluginComponent {
  name: string                    // 插件名称
  component: any                  // Vue 组件
  route?: {                      // 路由配置
    path: string
    name?: string
    meta?: Record<string, any>
  }
  menu?: MenuConfig              // 菜单配置
}
```

## 创建新插件

### 1. 后端插件开发

#### 第一步：创建插件目录

```bash
mkdir backend/src/plugins/my-plugin
```

#### 第二步：实现插件类

创建 `backend/src/plugins/my-plugin/index.ts`：

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { IPlugin } from '@/types'
import { ResponseHelper } from '@/utils/response'
import { EventBus } from '@/core/EventBus'

class MyPlugin implements IPlugin {
  name = 'my-plugin'
  version = '1.0.0'
  description = '我的自定义插件'
  author = 'Your Name'
  
  private eventBus: EventBus
  
  constructor() {
    this.eventBus = EventBus.getInstance()
  }
  
  async install(app: FastifyInstance): Promise<void> {
    // 插件安装逻辑
    console.log('My Plugin installed')
  }
  
  async uninstall(): Promise<void> {
    // 插件卸载逻辑
    console.log('My Plugin uninstalled')
  }
  
  routes = [
    {
      method: 'GET' as const,
      url: '/hello',
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        ResponseHelper.success(reply, { message: 'Hello from my plugin!' })
      },
      schema: {
        description: '插件问候接口',
        tags: ['MyPlugin']
      }
    }
  ]
  
  frontend = {
    component: 'MyPlugin',
    menu: {
      title: '我的插件',
      icon: 'Star',
      order: 10,
      path: '/plugins/my-plugin'
    }
  }
}

export default new MyPlugin()
```

### 2. 前端插件开发

#### 第一步：创建组件目录

```bash
mkdir frontend/src/plugins/my-plugin
```

#### 第二步：创建 Vue 组件

创建 `frontend/src/plugins/my-plugin/index.vue`：

```vue
<template>
  <div class="my-plugin">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><Star /></el-icon>
          <span>我的插件</span>
        </div>
      </template>
      
      <div class="plugin-content">
        <el-button @click="sayHello" :loading="loading">
          点击问候
        </el-button>
        
        <p v-if="message" class="message">{{ message }}</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/api/request'
import { ElMessage } from 'element-plus'
import { Star } from '@element-plus/icons-vue'

const loading = ref(false)
const message = ref('')

const sayHello = async () => {
  loading.value = true
  try {
    const response = await api.get('/plugins/my-plugin/hello')
    message.value = response.data.message
    ElMessage.success('问候成功!')
  } catch (error) {
    ElMessage.error('问候失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.my-plugin {
  max-width: 600px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-content {
  text-align: center;
  padding: 20px;
}

.message {
  margin-top: 16px;
  font-size: 16px;
  color: #409eff;
}
</style>
```

#### 第三步：注册前端组件

在 `frontend/src/main.ts` 中注册插件：

```typescript
// 加载自定义插件
const myPlugin = await import('@/plugins/my-plugin/index.vue')
pluginManager.register({
  name: 'MyPlugin',
  component: myPlugin.default,
  route: {
    path: '/plugins/my-plugin',
    name: 'MyPlugin'
  },
  menu: {
    title: '我的插件',
    icon: 'Star',
    order: 10,
    path: '/plugins/my-plugin'
  }
})
```

## 插件 API

### 事件系统

插件可以使用事件系统进行通信：

#### 后端发布事件

```typescript
// 发布事件
await this.eventBus.emit('my-plugin:action', { data: 'some data' }, 'MyPlugin')

// 订阅事件
this.eventBus.on('other-plugin:event', (payload) => {
  console.log('Received event:', payload)
})
```

#### 前端监听事件

```typescript
import { wsManager } from '@/core/WebSocketManager'

// 监听事件
wsManager.on('my-plugin:action', (payload) => {
  console.log('Plugin event:', payload)
})
```

### 数据库操作

插件可以使用共享的数据库连接：

```typescript
import { SQLiteAdapter } from '@/core/Database'

// 在插件中使用数据库
async install(app: FastifyInstance): Promise<void> {
  // 创建插件表
  await this.db.run(`
    CREATE TABLE IF NOT EXISTS my_plugin_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value TEXT,
      created_at INTEGER
    )
  `)
}

// 查询数据
async getData() {
  return await this.db.query('SELECT * FROM my_plugin_data')
}

// 插入数据
async addData(name: string, value: string) {
  return await this.db.run(
    'INSERT INTO my_plugin_data (name, value, created_at) VALUES (?, ?, ?)',
    [name, value, Date.now()]
  )
}
```

### HTTP 客户端

前端插件可以使用统一的 HTTP 客户端：

```typescript
import { api } from '@/api/request'

// GET 请求
const response = await api.get('/plugins/my-plugin/data')

// POST 请求
const result = await api.post('/plugins/my-plugin/data', {
  name: 'test',
  value: 'data'
})
```

## 插件配置

### 后端配置

插件可以在数据库中存储配置：

```typescript
// 保存配置
async saveConfig(config: any) {
  await this.db.run(
    'INSERT OR REPLACE INTO settings (key, value, type, update_time) VALUES (?, ?, ?, ?)',
    [`plugin:${this.name}:config`, JSON.stringify(config), 'json', Date.now()]
  )
}

// 加载配置
async loadConfig() {
  const result = await this.db.query(
    'SELECT value FROM settings WHERE key = ?',
    [`plugin:${this.name}:config`]
  )
  return result[0] ? JSON.parse(result[0].value) : {}
}
```

### 前端配置

前端可以提供配置界面：

```vue
<template>
  <div class="plugin-config">
    <el-form :model="config" label-width="120px">
      <el-form-item label="启用功能">
        <el-switch v-model="config.enabled" />
      </el-form-item>
      
      <el-form-item label="检查间隔">
        <el-input-number v-model="config.interval" :min="1" :max="3600" />
        <span class="form-help">秒</span>
      </el-form-item>
      
      <el-form-item>
        <el-button type="primary" @click="saveConfig">保存配置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api/request'
import { ElMessage } from 'element-plus'

const config = ref({
  enabled: true,
  interval: 60
})

const saveConfig = async () => {
  try {
    await api.post('/plugins/my-plugin/config', config.value)
    ElMessage.success('配置保存成功')
  } catch (error) {
    ElMessage.error('配置保存失败')
  }
}

const loadConfig = async () => {
  try {
    const response = await api.get('/plugins/my-plugin/config')
    config.value = { ...config.value, ...response.data }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

onMounted(() => {
  loadConfig()
})
</script>
```

## 插件部署

### 开发模式

1. 将插件文件放在对应的插件目录中
2. 重启服务器，插件会自动加载

### 生产模式

1. 构建插件代码
2. 将插件文件部署到服务器的插件目录
3. 通过插件管理界面启用插件

## 最佳实践

### 1. 错误处理

```typescript
// 在路由处理器中使用 try-catch
handler: async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const result = await someAsyncOperation()
    ResponseHelper.success(reply, result)
  } catch (error) {
    console.error('Plugin error:', error)
    ResponseHelper.error(reply, 'Operation failed', 'PLUGIN_ERROR')
  }
}
```

### 2. 资源清理

```typescript
async uninstall(): Promise<void> {
  // 清理定时器
  if (this.timer) {
    clearInterval(this.timer)
  }
  
  // 移除事件监听器
  this.eventBus.off('some-event', this.handleEvent)
  
  // 关闭数据库连接等
  await this.cleanup()
}
```

### 3. 版本兼容性

```typescript
// 检查依赖版本
async install(app: FastifyInstance): Promise<void> {
  if (this.dependencies) {
    for (const dep of this.dependencies) {
      if (!this.isPluginAvailable(dep)) {
        throw new Error(`Required plugin not available: ${dep}`)
      }
    }
  }
  
  // 继续安装...
}
```

### 4. 性能优化

- 使用数据库索引
- 实现适当的缓存策略
- 避免阻塞主线程的操作
- 合理使用事件系统

## 调试技巧

### 1. 日志输出

```typescript
// 使用统一的日志格式
console.log(`[${this.name}] Info message`)
console.warn(`[${this.name}] Warning message`)
console.error(`[${this.name}] Error message`)
```

### 2. API 测试

使用 Swagger UI 测试插件 API：
- 访问 `http://localhost:3000/docs`
- 查找插件相关的 API 端点
- 直接测试 API 功能

### 3. 前端调试

```typescript
// 在组件中添加调试信息
onMounted(() => {
  console.log('Plugin mounted:', pluginName)
  console.log('Plugin config:', config.value)
})
```

## 示例插件

参考项目中的示例插件：

1. **网络状态插件** (`backend/src/plugins/network-status/`)
   - 监控网络接口和连通性
   - 实时状态更新
   - 速度测试功能

2. **下载管理插件** (`backend/src/plugins/download-manager/`)
   - 文件下载队列管理
   - 进度跟踪
   - 并发控制

这些示例展示了插件系统的各种功能和最佳实践。