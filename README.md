# NAS 服务脚手架

一个基于插件化架构的 NAS 服务框架，支持低耦合的功能扩展。

## 技术栈

- **前端**: Vue 3 + Pinia + Vite
- **后端**: Node.js + Fastify + 插件系统  
- **通信**: REST API
- **数据库**: SQLite + 文件存储

## 项目结构

```
├── backend/          # 后端服务
│   ├── core/         # 核心框架
│   ├── plugins/      # 功能插件
│   ├── middleware/   # 中间件
│   └── utils/        # 工具函数
├── frontend/         # 前端应用
│   ├── src/
│   │   ├── core/     # 核心框架
│   │   ├── plugins/  # 功能插件
│   │   ├── shared/   # 共享组件
│   │   └── api/      # API 接口
└── docs/            # 文档
```

## 快速开始

### 方式一：自动安装脚本

```bash
# 运行一键安装脚本
./scripts/setup.sh
```

### 方式二：手动安装

1. 安装依赖
```bash
npm run install:all
```

2. 复制环境配置文件
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. 启动开发服务
```bash
npm run dev
```

4. 构建生产版本
```bash
npm run build
```

5. 启动生产服务
```bash
npm start
```

### 方式三：Docker 部署

```bash
# 使用 Docker Compose
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 插件开发

详见 [插件开发指南](docs/plugin-development.md)

## 特性

- ✅ **插件化架构** - 支持热插拔，低耦合扩展
- ✅ **REST API** - 统一的 HTTP 接口，支持多端接入
- ✅ **响应式界面** - 基于 Element Plus 的现代化 UI
- ✅ **实时通信** - WebSocket 支持实时状态更新
- ✅ **事件系统** - 插件间解耦通信
- ✅ **配置化管理** - 路由、菜单自动生成
- ✅ **数据持久化** - SQLite 数据库存储
- ✅ **Docker 支持** - 容器化部署
- ✅ **完整文档** - 详细的开发和部署指南
- ✅ **示例插件** - 网络状态监控、下载管理等

## 技术亮点

### 后端技术栈
- **Fastify** - 高性能 Node.js Web 框架
- **TypeScript** - 类型安全的 JavaScript
- **SQLite** - 轻量级数据库
- **插件系统** - 动态加载和管理
- **Swagger** - 自动 API 文档生成

### 前端技术栈  
- **Vue 3** - 渐进式 JavaScript 框架
- **Element Plus** - 企业级 UI 组件库
- **Pinia** - 状态管理
- **Vite** - 快速构建工具
- **TypeScript** - 类型安全开发

### 架构优势
- **微服务思想** - 插件独立部署和管理
- **事件驱动** - 松耦合的组件通信
- **响应式设计** - 适配多种设备屏幕
- **容器化部署** - 一键部署到任何环境
- **开发友好** - 热重载、完整的开发工具链