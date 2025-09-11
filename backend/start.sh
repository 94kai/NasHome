#!/bin/bash

# NAS Tools 启动脚本

echo "🚀 启动 NAS Tools 服务..."

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
fi

# 创建日志目录
mkdir -p logs

# 安装依赖
echo "📦 安装依赖包..."
npm install

# 启动服务
echo "🚀 启动服务..."
pm2 start ecosystem.config.js

echo "✅ 服务启动完成！"
echo "📍 访问地址: http://localhost:3000"
echo "🔧 API文档: http://localhost:3000/api"
echo ""
echo "常用命令："
echo "  pm2 status          - 查看服务状态"
echo "  pm2 logs nas-tools  - 查看日志"
echo "  pm2 restart nas-tools - 重启服务"
echo "  pm2 stop nas-tools  - 停止服务"
