const express = require('express');
const {
    authenticateToken,
    optionalAuth
} = require('../middleware/auth');
const router = express.Router();

// 系统监控相关接口
router.get('/status', async (req, res) => {
    try {
        const os = require('os');

        res.json({
            success: true,
            data: {
                cpu: {
                    usage: 0, // 需要实际计算
                    cores: os.cpus().length
                },
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem()
                },
                disk: {
                    // 需要实际获取磁盘信息
                    total: 0,
                    free: 0,
                    used: 0
                },
                network: {
                    // 网络状态信息
                    interfaces: os.networkInterfaces()
                },
                uptime: os.uptime(),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('获取系统状态错误:', error);
        res.status(500).json({
            error: '获取系统状态失败'
        });
    }
});


// 基础系统信息
router.get('/system', authenticateToken, async (req, res) => {
    try {
        const os = require('os');

        res.json({
            success: true,
            data: {
                platform: os.platform(),
                arch: os.arch(),
                uptime: os.uptime(),
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpuCount: os.cpus().length,
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('获取系统信息错误:', error);
        res.status(500).json({
            error: '获取系统信息失败'
        });
    }
});

module.exports = router;
