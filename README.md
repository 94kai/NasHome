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

## 🚀 开发阶段

cd backend
npm install
npm run dev

cd frontend
npm install
npm run dev


## 🚀 上线

cd backend
npm install
pm2 start ecosystem.config.js

### 更新前端
cd frontend
npm install
npm run build
