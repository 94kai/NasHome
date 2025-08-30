# 部署指南

## 环境要求

### 系统要求

- **操作系统**: Linux, macOS, Windows
- **Node.js**: 版本 18.0 或更高
- **内存**: 最少 512MB RAM，推荐 1GB 或更多
- **存储**: 最少 1GB 可用空间

### 依赖软件

- **Node.js 和 npm**: 用于运行服务端和构建前端
- **SQLite**: 数据库存储（自动安装）
- **Git**: 版本控制（可选）

## 安装部署

### 1. 获取源码

```bash
# 克隆项目（如果使用 Git）
git clone <repository-url> nas-service
cd nas-service

# 或者下载并解压源码包
```

### 2. 安装依赖

```bash
# 安装所有依赖（前端 + 后端）
npm run install:all

# 或者分别安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 3. 构建项目

```bash
# 构建前端和后端
npm run build

# 或者分别构建
npm run build:frontend
npm run build:backend
```

### 4. 启动服务

```bash
# 生产模式启动
npm start

# 开发模式启动（支持热重载）
npm run dev
```

## 配置选项

### 环境变量配置

创建 `.env` 文件来配置环境变量：

```bash
# 服务器配置
HOST=0.0.0.0
PORT=3000
CORS=true

# 数据库配置
DB_PATH=./data/nas.db

# 插件配置
PLUGIN_AUTO_LOAD=true
PLUGIN_DIR=./backend/src/plugins

# 日志配置
LOG_LEVEL=info
```

### 配置文件

可以通过修改 `backend/src/utils/config.ts` 来调整默认配置：

```typescript
export const config: AppConfig = {
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000'),
    cors: process.env.CORS !== 'false'
  },
  database: {
    type: 'sqlite',
    path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'nas.db')
  },
  plugins: {
    autoLoad: process.env.PLUGIN_AUTO_LOAD !== 'false',
    directory: process.env.PLUGIN_DIR || path.join(__dirname, '..', 'plugins')
  }
}
```

## Docker 部署

### 1. 创建 Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制 package.json 文件
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# 安装依赖
RUN npm run install:all

# 复制源代码
COPY . .

# 构建项目
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
```

### 2. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  nas-service:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./downloads:/app/downloads
      - ./logs:/app/logs
    environment:
      - HOST=0.0.0.0
      - PORT=3000
      - DB_PATH=/app/data/nas.db
    restart: unless-stopped
    
  # 可选：添加反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - nas-service
    restart: unless-stopped
```

### 3. 构建和运行

```bash
# 构建镜像
docker build -t nas-service .

# 使用 docker-compose 启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 反向代理配置

### Nginx 配置示例

创建 `nginx.conf` 文件：

```nginx
events {
    worker_connections 1024;
}

http {
    upstream nas_backend {
        server nas-service:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # 静态文件
        location / {
            proxy_pass http://nas_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket 支持
        location /api/ws {
            proxy_pass http://nas_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API 路由
        location /api/ {
            proxy_pass http://nas_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Apache 配置示例

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    
    ProxyPreserveHost On
    ProxyRequests Off
    
    # 主应用代理
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # WebSocket 支持
    ProxyPass /api/ws ws://localhost:3000/api/ws
    ProxyPassReverse /api/ws ws://localhost:3000/api/ws
    
    # 启用 WebSocket 模块
    LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
</VirtualHost>
```

## 系统服务配置

### systemd 服务（Linux）

创建 `/etc/systemd/system/nas-service.service`：

```ini
[Unit]
Description=NAS Service
After=network.target

[Service]
Type=simple
User=nas
WorkingDirectory=/opt/nas-service
ExecStart=/usr/bin/node backend/dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启用和启动服务：

```bash
# 重载配置
sudo systemctl daemon-reload

# 启用服务（开机自启）
sudo systemctl enable nas-service

# 启动服务
sudo systemctl start nas-service

# 查看状态
sudo systemctl status nas-service

# 查看日志
sudo journalctl -u nas-service -f
```

### PM2 进程管理

安装 PM2：

```bash
npm install -g pm2
```

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'nas-service',
    script: './backend/dist/index.js',
    cwd: '/opt/nas-service',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
    time: true
  }]
}
```

使用 PM2 管理：

```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs nas-service

# 重启应用
pm2 restart nas-service

# 停止应用
pm2 stop nas-service

# 设置开机自启
pm2 startup
pm2 save
```

## SSL/HTTPS 配置

### 使用 Let's Encrypt

```bash
# 安装 certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 配置 nginx 使用 SSL
```

更新 nginx 配置：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 其他配置...
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## 监控和日志

### 日志配置

应用日志会自动输出到控制台。在生产环境中，建议配置日志文件：

```typescript
// 在 backend/src/index.ts 中配置
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || undefined
  }
})
```

### 监控配置

可以使用各种监控工具：

1. **系统监控**: htop, iostat, netstat
2. **应用监控**: PM2 Monitor, New Relic
3. **日志分析**: ELK Stack, Grafana
4. **性能监控**: Node.js APM 工具

### 健康检查

应用提供了健康检查端点：

```bash
# 检查应用状态
curl http://localhost:3000/api/health

# 响应示例
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": 1635123456789,
    "uptime": 3600
  }
}
```

## 备份策略

### 数据库备份

```bash
#!/bin/bash
# backup.sh

DB_PATH="/opt/nas-service/data/nas.db"
BACKUP_DIR="/opt/nas-service/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp $DB_PATH $BACKUP_DIR/nas_$DATE.db

# 保留最近 7 天的备份
find $BACKUP_DIR -name "nas_*.db" -mtime +7 -delete

echo "Backup completed: nas_$DATE.db"
```

设置定时备份：

```bash
# 添加到 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /opt/nas-service/backup.sh
```

### 配置备份

定期备份重要配置文件：

- 应用配置文件
- 插件文件
- 环境配置
- nginx/apache 配置

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查找占用端口的进程
   sudo netstat -tlnp | grep :3000
   
   # 或使用 lsof
   sudo lsof -i :3000
   ```

2. **权限问题**
   ```bash
   # 确保正确的文件权限
   sudo chown -R nas:nas /opt/nas-service
   sudo chmod -R 755 /opt/nas-service
   ```

3. **数据库锁定**
   ```bash
   # 检查数据库文件权限
   ls -la data/nas.db
   
   # 重新启动应用
   sudo systemctl restart nas-service
   ```

4. **内存不足**
   ```bash
   # 检查系统内存使用
   free -h
   
   # 检查应用内存使用
   ps aux | grep node
   ```

### 日志分析

```bash
# 查看应用日志
sudo journalctl -u nas-service -n 100

# 查看错误日志
sudo journalctl -u nas-service --priority=err

# 实时查看日志
sudo journalctl -u nas-service -f
```

## 性能优化

### Node.js 优化

```bash
# 设置环境变量
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=1024"
```

### 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_plugins_name ON plugins(name);
CREATE INDEX idx_settings_key ON settings(key);

-- 定期清理
VACUUM;
ANALYZE;
```

### 前端优化

- 启用 gzip 压缩
- 配置缓存策略
- 使用 CDN
- 代码分割和懒加载

通过以上配置，你就可以成功部署和运行 NAS 服务脚手架了。根据实际需求调整配置和优化策略。