# 工具注册系统使用指南

## 概述

工具注册系统将工具管理从数据库操作改为代码注册的方式，让您可以通过修改配置文件来管理工具，无需直接操作数据库。

## 文件结构

```
backend/src/
├── services/
│   └── toolRegistry.js      # 工具注册系统核心类
├── config/
│   └── tools.js            # 工具配置文件（主要修改此文件）
└── routes/
    └── api.js              # API路由（已更新为使用注册系统）
```

## 如何添加新工具

### 1. 编辑工具配置文件

打开 `backend/src/config/tools.js` 文件，在 `toolsConfig` 数组中添加新的工具配置：

```javascript
{
  id: 'your-tool-id',           // 工具唯一标识（必填）
  name: '工具名称',              // 工具显示名称（必填）
  description: '工具描述',       // 工具描述（可选）
  url: '/your-tool-url',        // 工具链接（可选）
  icon: '🔧',                   // 工具图标（可选，默认为🔧）
  category: 'your-category',    // 工具分类（可选，默认为other）
  isActive: true,               // 是否激活（可选，默认为true）
  metadata: {                   // 额外元数据（可选）
    version: '1.0.0',
    author: 'Your Name',
    tags: ['标签1', '标签2']
  }
}
```

### 2. 重启服务器

修改配置后，重启服务器即可生效：

```bash
cd backend
npm start
```

## 如何删除工具

### 1. 编辑工具配置文件

在 `backend/src/config/tools.js` 文件中，从 `toolsConfig` 数组中删除对应的工具配置。

### 2. 重启服务器

重启服务器后，工具将被移除。

## 如何修改工具

### 1. 编辑工具配置文件

在 `backend/src/config/tools.js` 文件中，修改对应工具的配置信息。

### 2. 重启服务器

重启服务器后，修改将生效。

## 如何临时停用工具

### 方法1：修改配置文件
在 `tools.js` 中将工具的 `isActive` 设置为 `false`。


## 新增的API端点

### 获取工具分类列表
```
GET /api/tools/categories
```

### 获取工具统计信息
```
GET /api/tools/stats
```

## 工具分类

系统预定义了以下分类：
- `file` - 文件管理类
- `download` - 下载类
- `system` - 系统管理类
- `media` - 媒体类
- `network` - 网络类
- `development` - 开发工具类
- `other` - 其他

您可以在配置文件中使用这些分类，或创建新的分类。

## 注意事项

1. **工具ID必须唯一**：每个工具的ID在系统中必须唯一
2. **重启生效**：修改配置文件后需要重启服务器才能生效
3. **API兼容性**：现有的API接口保持兼容，前端无需修改
4. **数据持久化**：通过API添加的工具在重启后会丢失，建议通过配置文件管理工具

## 示例：添加一个新的工具

假设要添加一个"系统备份"工具：

1. 打开 `backend/src/config/tools.js`
2. 在 `toolsConfig` 数组中添加：

```javascript
{
  id: 'system-backup',
  name: '系统备份',
  description: '系统数据备份和恢复工具',
  url: '/system-backup',
  icon: '💾',
  category: 'system',
  isActive: true,
  metadata: {
    version: '1.0.0',
    author: 'NAS Tools',
    tags: ['备份', '系统', '数据']
  }
}
```

3. 重启服务器
4. 工具将出现在前端界面中

这样就完成了工具的添加，无需操作数据库！
