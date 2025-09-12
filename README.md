# NAS Home - 简易工具集合

一个专为个人NAS设计的简易工具集合，采用前后端分离架构。

## 📁 项目结构

```
nas-tools/
├── backend/                 # 后端服务
│   ├── src/                # 后端源码
│   ├── package.json        # 后端依赖
│   ├── ecosystem.config.js # PM2配置
│   └── start.sh           # 启动脚本
├── frontend/               # 前端应用
│   ├── src/               # 前端源码
│   └── package.json       # 前端依赖
└── README.md              # 项目说明
```

## 🚀 快速开始

### 1. 安装依赖
```bash
# 安装后端依赖
cd backend
npm install


### 2. 启动服务
```bash
# 启动后端服务
cd backend
./start.sh

# 或者手动启动
npm start
```

### 3. 访问应用
- 主页面: http://localhost:3000
- API文档: http://localhost:3000/api
- 健康检查: http://localhost:3000/health

## 🔧 开发说明

### 后端开发
```bash
cd backend
npm run dev  # 开发模式，自动重启
```

## 📦 部署

### 使用PM2部署
```bash
cd backend
pm2 start ecosystem.config.js
pm2 status
```

### 查看日志
```bash
pm2 logs nas-tools-backend
```

## 🔑 默认账号

- **用户名**: admin
- **密码**: admin123

## 📄 许可证

MIT License
