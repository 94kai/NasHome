#!/bin/bash

# NAS 服务脚手架安装脚本

echo "🚀 开始安装 NAS 服务脚手架..."

# 检查 Node.js 版本
node_version=$(node -v 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ 错误: 未检测到 Node.js，请先安装 Node.js 18+ "
    exit 1
fi

echo "✅ 检测到 Node.js 版本: $node_version"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未检测到 npm"
    exit 1
fi

echo "✅ 检测到 npm"

# 安装根目录依赖
echo "📦 安装根目录依赖..."
npm install

# 安装后端依赖
echo "📦 安装后端依赖..."
cd backend
npm install
cd ..

# 安装前端依赖
echo "📦 安装前端依赖..."
cd frontend
npm install
cd ..

# 创建必要的目录
echo "📁 创建目录结构..."
mkdir -p data
mkdir -p downloads
mkdir -p logs

# 复制环境变量文件
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ 创建后端环境配置文件"
fi

if [ ! -f frontend/.env ]; then
    cp frontend/.env.example frontend/.env
    echo "✅ 创建前端环境配置文件"
fi

# 构建项目
echo "🔨 构建项目..."
npm run build

echo ""
echo "🎉 安装完成！"
echo ""
echo "📝 快速开始:"
echo "  开发模式: npm run dev"
echo "  生产模式: npm start"
echo "  访问地址: http://localhost:3000"
echo ""
echo "📖 更多信息请查看 README.md 和 docs/ 目录"