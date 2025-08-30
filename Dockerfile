FROM node:18-alpine

# 安装必要的系统工具
RUN apk add --no-cache \
    curl \
    bash \
    sqlite

# 设置工作目录
WORKDIR /app

# 复制 package.json 文件
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# 安装依赖
RUN npm ci --only=production && \
    cd backend && npm ci --only=production && \
    cd ../frontend && npm ci --only=production

# 复制源代码
COPY . .

# 构建前端
RUN cd frontend && npm run build

# 构建后端
RUN cd backend && npm run build

# 创建必要的目录
RUN mkdir -p /app/data /app/downloads /app/logs

# 设置权限
RUN addgroup -g 1001 -S nas && \
    adduser -S nas -u 1001 && \
    chown -R nas:nas /app

USER nas

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]