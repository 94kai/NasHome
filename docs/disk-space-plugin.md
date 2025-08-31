# 磁盘空间插件

## 概述

磁盘空间插件用于监控和显示系统的磁盘使用情况，提供直观的磁盘空间监控界面。

## 功能特性

- **实时监控**: 显示所有磁盘分区的使用情况
- **主磁盘概览**: 突出显示主要磁盘的信息
- **可视化进度条**: 直观的磁盘使用率显示
- **跨平台支持**: 支持Windows、Linux和macOS
- **自动刷新**: 支持手动刷新磁盘信息

## 技术实现

### 后端实现

#### 插件结构
```
backend/src/plugins/disk-space/
├── index.ts          # 主插件文件
```

#### API接口

- `GET /api/disk-space` - 获取所有磁盘信息
- `GET /api/disk-space/main` - 获取主要磁盘信息

#### 磁盘信息格式
```typescript
interface DiskInfo {
  mount: string        // 挂载点
  total: number        // 总容量（字节）
  used: number         // 已使用（字节）
  available: number    // 可用空间（字节）
  usePercent: number   // 使用百分比
}
```

#### 跨平台兼容性

插件支持多种操作系统：

- **Windows**: 使用 `wmic` 命令获取磁盘信息
- **Linux**: 使用 `df -B1` 命令
- **macOS**: 使用 `df -k` 命令并转换单位

### 前端实现

#### 插件结构
```
frontend/src/plugins/disk-space/
├── index.vue         # 主组件
```

#### API调用
```typescript
import { diskSpaceApi } from '@/api/disk-space'

// 获取所有磁盘信息
const response = await diskSpaceApi.getDiskSpace()

// 获取主要磁盘信息
const response = await diskSpaceApi.getMainDiskInfo()
```

## 使用方法

### 1. 插件自动加载

插件会在系统启动时自动加载和安装：

```bash
# 启动后端服务器
cd backend && npm start
```

### 2. 手动启用插件

如果需要手动启用插件，可以使用提供的脚本：

```bash
# 运行启用脚本
node enable-disk-space-plugin.js
```

### 3. 访问插件界面

启动前端开发服务器后：

```bash
# 启动前端开发服务器
cd frontend && npm run dev
```

然后在浏览器中访问 `http://localhost:5173`，在侧边栏中点击"磁盘空间"即可查看磁盘使用情况。

## 界面特性

### 主磁盘概览卡片
- 显示主要磁盘的总容量、已使用空间、可用空间和使用率
- 提供彩色进度条，直观显示使用情况
- 根据使用率显示不同颜色（绿色/橙色/红色）

### 磁盘分区列表
- 显示所有磁盘分区的详细信息
- 每个分区显示使用情况进度条
- 支持多种磁盘分区类型的显示

### 响应式设计
- 支持移动端和桌面端
- 自适应布局

## 故障排除

### 常见问题

1. **磁盘信息为空**
   - 检查系统权限，确保有读取磁盘信息的权限
   - 在macOS上，确保终端有执行 `df` 命令的权限

2. **插件未加载**
   - 检查后端日志，确认插件是否正确安装
   - 确保插件目录结构正确

3. **前端显示错误**
   - 检查API连接是否正常
   - 查看浏览器控制台错误信息

### 日志查看

```bash
# 查看后端日志
cd backend && npm start

# 查看前端日志（浏览器开发者工具）
# F12 -> Console
```

## 扩展开发

### 添加新功能

1. **自定义刷新间隔**
   - 在前端组件中添加定时器自动刷新

2. **磁盘健康监控**
   - 添加磁盘健康状态检测

3. **历史数据存储**
   - 将磁盘使用情况存储到数据库中
   - 提供历史趋势图表

### 插件配置

可以在插件中添加配置选项：

```typescript
// 在插件类中添加配置
frontend = {
  component: 'DiskSpace',
  menu: {
    title: '磁盘空间',
    icon: 'HardDrive',
    order: 2,
    path: '/plugins/disk-space'
  },
  // 添加配置选项
  config: {
    refreshInterval: 30000,  // 30秒刷新间隔
    showHiddenPartitions: false  // 是否显示隐藏分区
  }
}
```

## API参考

### 响应格式

成功响应：
```json
{
  "success": true,
  "data": [
    {
      "mount": "/",
      "total": 994662584320,
      "used": 9817309184,
      "available": 191218434048,
      "usePercent": 5
    }
  ],
  "timestamp": 1756613612847
}
```

错误响应：
```json
{
  "success": false,
  "message": "获取磁盘信息失败",
  "timestamp": 1756613612847
}
```

## 版本信息

- **版本**: 1.0.0
- **作者**: System
- **最后更新**: 2024-01-01

