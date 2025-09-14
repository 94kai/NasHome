const express = require('express');
const router = express.Router();

// 生成测试数据 - 用于下载速度测试
router.get('/download', (req, res) => {
    const size = parseInt(req.query.size) || 1024 * 1024; // 默认1MB
    const data = Buffer.alloc(size, 'A'); // 生成指定大小的数据
    
    res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': size.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    res.send(data);
});


// 基于时间限制的上传速度测试
router.post('/upload-timed', (req, res) => {
    const testDuration = parseInt(req.query.duration) || 5000; // 默认5秒
    const startTime = Date.now();
    
    // 设置超时时间比测试时间稍长
    req.setTimeout(testDuration + 2000);
    
    let receivedBytes = 0;
    let isTestComplete = false;
    let testEndTime = null;
    
    // 设置测试时间限制
    const testTimer = setTimeout(() => {
        if (!isTestComplete) {
            isTestComplete = true;
            testEndTime = Date.now();
            
            // 强制结束请求
            req.destroy();
            
            const duration = testEndTime - startTime;
            const speedBps = duration > 0 ? receivedBytes / (duration / 1000) : 0;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            
            const sizeMB = Math.round(receivedBytes / 1024 / 1024 * 100) / 100;
            const speedKBps = Math.round(speedBps / 1024);
            const speedMBps = Math.round(speedMbps * 100) / 100;
            
            console.log(`定时上传测试完成: ${sizeMB}MB, ${duration}ms, ${speedKBps} KB/s (${speedMBps} MB/s)`);
            
            res.json({
                success: true,
                receivedBytes: receivedBytes,
                duration: duration,
                speedBps: Math.round(speedBps),
                speedMbps: Math.round(speedMbps * 100) / 100,
                testType: 'timed',
                timestamp: new Date().toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    hour12: false
                })
            });
        }
    }, testDuration);
    
    req.on('data', (chunk) => {
        if (!isTestComplete) {
            receivedBytes += chunk.length;
        }
    });
    
    req.on('end', () => {
        if (!isTestComplete) {
            clearTimeout(testTimer);
            isTestComplete = true;
            testEndTime = Date.now();
            
            const duration = testEndTime - startTime;
            const speedBps = duration > 0 ? receivedBytes / (duration / 1000) : 0;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            
            const sizeMB = Math.round(receivedBytes / 1024 / 1024 * 100) / 100;
            const speedKBps = Math.round(speedBps / 1024);
            const speedMBps = Math.round(speedMbps * 100) / 100;
            
            console.log(`上传完成(提前结束): ${sizeMB}MB, ${duration}ms, ${speedKBps} KB/s (${speedMBps} MB/s)`);
            
            res.json({
                success: true,
                receivedBytes: receivedBytes,
                duration: duration,
                speedBps: Math.round(speedBps),
                speedMbps: Math.round(speedMbps * 100) / 100,
                testType: 'timed',
                timestamp: new Date().toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    hour12: false
                })
            });
        }
    });
    
    req.on('error', (err) => {
        if (!isTestComplete) {
            clearTimeout(testTimer);
            isTestComplete = true;
            
            res.status(500).json({
                success: false,
                error: '上传测试失败',
                message: err.message
            });
        }
    });
});

// 存储上传测试结果
let uploadTestResult = null;

// 简化的上传速度测试
router.post('/upload', (req, res) => {
    const startTime = Date.now();
    const testDuration = 5000; // 5秒测试
    
    // 设置超时时间
    req.setTimeout(testDuration + 2000);
    
    let receivedBytes = 0;
    let isTestComplete = false;
    let testEndTime = null;
    
    // 设置测试时间限制
    const testTimer = setTimeout(() => {
        if (!isTestComplete) {
            isTestComplete = true;
            testEndTime = Date.now();
            
            // 强制结束请求
            req.destroy();
            
            const duration = testEndTime - startTime;
            const speedBps = duration > 0 ? receivedBytes / (duration / 1000) : 0;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            
            const sizeMB = Math.round(receivedBytes / 1024 / 1024 * 100) / 100;
            const speedKBps = Math.round(speedBps / 1024);
            const speedMBps = Math.round(speedMbps * 100) / 100;
            
            console.log(`上传测试完成: ${sizeMB}MB, ${duration}ms, ${speedKBps} KB/s (${speedMBps} MB/s)`);
            
            // 保存测试结果
            uploadTestResult = {
                success: true,
                receivedBytes: receivedBytes,
                duration: duration,
                speedBps: Math.round(speedBps),
                speedMbps: Math.round(speedMbps * 100) / 100,
                timestamp: new Date().toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    hour12: false
                })
            };
            
            res.json(uploadTestResult);
        }
    }, testDuration);
    
    req.on('data', (chunk) => {
        if (!isTestComplete) {
            receivedBytes += chunk.length;
        }
    });
    
    req.on('end', () => {
        if (!isTestComplete) {
            clearTimeout(testTimer);
            isTestComplete = true;
            testEndTime = Date.now();
            
            const duration = testEndTime - startTime;
            const speedBps = duration > 0 ? receivedBytes / (duration / 1000) : 0;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            
            const sizeMB = Math.round(receivedBytes / 1024 / 1024 * 100) / 100;
            const speedKBps = Math.round(speedBps / 1024);
            const speedMBps = Math.round(speedMbps * 100) / 100;
            
            console.log(`上传完成(提前结束): ${sizeMB}MB, ${duration}ms, ${speedKBps} KB/s (${speedMBps} MB/s)`);
            
            // 保存测试结果
            uploadTestResult = {
                success: true,
                receivedBytes: receivedBytes,
                duration: duration,
                speedBps: Math.round(speedBps),
                speedMbps: Math.round(speedMbps * 100) / 100,
                timestamp: new Date().toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    hour12: false
                })
            };
            
            res.json(uploadTestResult);
        }
    });
    
    req.on('error', (err) => {
        if (!isTestComplete) {
            clearTimeout(testTimer);
            isTestComplete = true;
            
            res.status(500).json({
                success: false,
                error: '上传测试失败',
                message: err.message
            });
        }
    });
});

// 获取上传速度
router.get('/upload-speed', (req, res) => {
    if (uploadTestResult) {
        res.json(uploadTestResult);
    } else {
        res.status(404).json({
            success: false,
            error: '没有找到上传测试结果'
        });
    }
});

// 获取测速状态
router.get('/status', (req, res) => {
    res.json({
        status: 'ready',
        timestamp: new Date().toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour12: false
        })
    });
});

module.exports = router;
