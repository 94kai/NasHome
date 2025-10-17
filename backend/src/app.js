const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const listEndpoints = require('express-list-endpoints');
const history = require('connect-history-api-fallback');
require('dotenv').config({
    path: './config.env'
});

const {
    initDatabase
} = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors()); // 跨域支持
app.use(morgan('combined')); // 日志
app.use(express.json()); // JSON解析
app.use(express.urlencoded({
    extended: true
})); // URL编码解析



// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/media', require('./routes/media'));
app.use('/api/monitor', require('./routes/monitor'));
app.use('/api/speedtest', require('./routes/speedtest'));

// api列表
app.get('/api', (req, res) => {
    const currentTime = new Date(); // 当前时间
    const startTime = new Date(currentTime - process.uptime() * 1000).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false // 24小时制
    });
    const cleanedEndpoints = listEndpoints(app).map(route => {
        const {
            middlewares,
            ...rest
        } = route; // 解构分离 middlewares
        const filteredMiddlewares = middlewares.filter(mw => mw !== 'anonymous');
        return {
            ...rest,
            ...(filteredMiddlewares && filteredMiddlewares.length > 0 && {
                middlewares: filteredMiddlewares
            })
        };
    });
    res.json({
        status: 'ok',
        uptime: startTime,
        api: cleanedEndpoints
    })
});

app.use(history());
// 静态文件服务 - 指向前端构建后的文件
app.use(express.static(path.join(__dirname, '../../frontend/dist/')));
app.use(express.static(path.join(__dirname, '../../static/')));

// 错误处理
app.use((err, req, res, next) => {
    console.log('error');
    console.error(err.stack);

    res.status(500).json({
        error: '服务器内部错误'
    });
});

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        await initDatabase();
        console.log('✅ 数据库初始化完成');

        // 启动服务器
        app.listen(PORT, "::", () => {
            console.log(`🚀 服务器启动成功！`);
            console.log(`📍 访问地址: http://localhost:${PORT}`);
            console.log(`🔧 API文档: http://localhost:${PORT}/api`);
            console.log(`💚 健康检查: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();
