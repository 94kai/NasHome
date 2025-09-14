<template>
    <div class="speedtest-container">
        <h3>网络测速</h3>
        <p>测试您的网络下载和上传速度</p>
        
        <div class="test-controls">
            <button @click="startDownloadTest" :disabled="isTestingDownload || isTestingUpload" class="download-btn">
                {{ isTestingDownload ? '下载测试中...' : '测试下载速度' }}
            </button>
            <button @click="startTimedUploadTest" :disabled="isTestingDownload || isTestingUpload" class="upload-btn">
                {{ isTestingUpload ? '上传测试中...' : '测试上传速度' }}
            </button>
            <button @click="resetResults" :disabled="isTestingDownload || isTestingUpload" class="reset-btn">
                重置结果
            </button>
        </div>

        <div v-if="isTestingDownload || isTestingUpload" class="progress-section">
            <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <p class="progress-text">{{ currentTest }}</p>
            <div v-if="currentSpeed" class="current-speed">
                <span class="speed-label">当前速度:</span>
                <span class="speed-value">{{ formatSpeed(currentSpeed) }}</span>
            </div>
        </div>

        <div v-if="results && (results.download || results.upload)" class="results-section">
            <h4>测速结果</h4>
            <div class="result-grid">
                <div class="result-item" v-if="results.download">
                    <div class="result-label">下载速度</div>
                    <div class="result-value">{{ results.download.speedMbps }} Mbps</div>
                    <div class="result-detail">{{ formatSpeed(results.download.speedBps) }}</div>
                </div>
                <div class="result-item" v-if="results.upload">
                    <div class="result-label">上传速度</div>
                    <div class="result-value">{{ results.upload.speedMbps }} Mbps</div>
                    <div class="result-detail">{{ formatSpeed(results.upload.speedBps) }}</div>
                </div>
            </div>
            <div class="result-timestamp">
                测试时间: {{ results.timestamp }}
            </div>
        </div>

        <div v-if="error" class="error-section">
            <h4>测试失败</h4>
            <p>{{ error }}</p>
        </div>
    </div>
</template>

<script>
export default {
    name: 'SpeedTest',
    data() {
        return {
            isTestingDownload: false,
            isTestingUpload: false,
            progress: 0,
            currentTest: '',
            currentSpeed: 0,
            results: null,
            error: null
        };
    },
    methods: {
        async startDownloadTest() {
            this.isTestingDownload = true;
            this.progress = 0;
            this.currentTest = '';
            this.currentSpeed = 0;
            this.error = null;

            try {
                this.currentTest = '正在测试下载速度...';
                const downloadResult = await this.testDownloadSpeed();

                // 更新结果
                if (!this.results) {
                    this.results = {
                        download: null,
                        upload: null,
                        timestamp: new Date().toLocaleString('zh-CN', {
                            timeZone: 'Asia/Shanghai',
                            hour12: false
                        })
                    };
                }
                this.results.download = downloadResult;

                this.progress = 100;
                this.currentTest = '下载测试完成';
                this.currentSpeed = 0;

            } catch (err) {
                this.error = err.message || '下载测试失败，请重试';
            } finally {
                this.isTestingDownload = false;
                setTimeout(() => {
                    this.progress = 0;
                    this.currentTest = '';
                    this.currentSpeed = 0;
                }, 1000);
            }
        },


        async testDownloadSpeed() {
            const startTime = Date.now();
            let lastUpdateTime = startTime;
            let lastReceivedBytes = 0;
            let totalReceivedBytes = 0;
            let currentSpeedBps = 0;
            
            // 简化策略：固定5秒测试
            const testDuration = 5000; // 固定5秒
            const updateInterval = 200; // 200ms更新一次
            
            let shouldStop = false;
            
            // 速度平滑算法：使用加权移动平均
            const speedHistory = [];
            const maxHistoryLength = 3; // 保留最近3个速度值，减少延迟
            
            // 设置速度更新定时器
            const speedUpdateInterval = setInterval(() => {
                const now = Date.now();
                const timeDiff = (now - lastUpdateTime) / 1000; // 秒
                const bytesDiff = totalReceivedBytes - lastReceivedBytes;
                
                if (timeDiff > 0 && bytesDiff > 0) {
                    // 计算瞬时速度
                    const instantSpeed = bytesDiff / timeDiff;
                    
                    // 添加到历史记录
                    speedHistory.push(instantSpeed);
                    if (speedHistory.length > maxHistoryLength) {
                        speedHistory.shift(); // 移除最旧的值
                    }
                    
                    // 计算加权移动平均速度（最近的权重更高）
                    let weightedSum = 0;
                    let totalWeight = 0;
                    for (let i = 0; i < speedHistory.length; i++) {
                        const weight = i + 1; // 权重：1, 2, 3...
                        weightedSum += speedHistory[i] * weight;
                        totalWeight += weight;
                    }
                    
                    currentSpeedBps = weightedSum / totalWeight;
                    
                    // 同时计算整体平均速度（更接近最终结果）
                    const totalTime = (now - startTime) / 1000;
                    const overallSpeed = totalTime > 0 ? totalReceivedBytes / totalTime : currentSpeedBps;
                    
                    // 使用整体平均速度作为显示速度（更准确）
                    this.currentSpeed = overallSpeed;
                }
                
                lastUpdateTime = now;
                lastReceivedBytes = totalReceivedBytes;
            }, updateInterval);
            
            try {
                // 使用fetch进行连续下载测试
                const response = await fetch(`/api/speedtest/download?size=${1024 * 1024 * 100}&r=${Math.random()}`);
                if (!response.ok) {
                    throw new Error('下载测试失败');
                }

                const reader = response.body.getReader();
                
                // 简化的测试循环：5秒后自动结束
                const testInterval = setInterval(() => {
                    const now = Date.now();
                    const elapsed = now - startTime;
                    
                    // 5秒后结束测试
                    if (elapsed >= testDuration) {
                        shouldStop = true;
                        clearInterval(testInterval);
                        clearInterval(speedUpdateInterval);
                        reader.cancel();
                    }
                }, updateInterval);
                
                // 持续读取数据
                while (!shouldStop) {
                    const { done, value } = await reader.read();
                    if (done || shouldStop) break;
                    totalReceivedBytes += value.length;
                }
                
                clearInterval(testInterval);
                clearInterval(speedUpdateInterval);
                
            } catch (error) {
                shouldStop = true; // 发生错误时也设置停止标志
                clearInterval(speedUpdateInterval);
                throw error;
            }

            const endTime = Date.now();
            const totalDuration = endTime - startTime;
            
            // 简化计算：使用总时间和总字节数
            const avgSpeedBps = totalReceivedBytes / (totalDuration / 1000);
            const avgSpeedMbps = (avgSpeedBps * 8) / (1024 * 1024);

            return {
                speedBps: Math.round(avgSpeedBps),
                speedMbps: Math.round(avgSpeedMbps * 100) / 100,
                duration: totalDuration,
                testSize: totalReceivedBytes
            };
        },


        async startTimedUploadTest() {
            this.isTestingUpload = true;
            this.progress = 0;
            this.currentTest = '';
            this.currentSpeed = 0;
            this.error = null;

            try {
                this.currentTest = '正在准备定时上传测试...';
                const uploadResult = await this.testTimedUploadSpeed();

                // 更新结果
                if (!this.results) {
                    this.results = {
                        download: null,
                        upload: null,
                        timestamp: new Date().toLocaleString('zh-CN', {
                            timeZone: 'Asia/Shanghai',
                            hour12: false
                        })
                    };
                }
                this.results.upload = uploadResult;

                this.progress = 100;
                this.currentTest = '定时上传测试完成';
                this.currentSpeed = 0;

            } catch (err) {
                this.error = err.message || '定时上传测试失败，请重试';
            } finally {
                this.isTestingUpload = false;
                setTimeout(() => {
                    this.progress = 0;
                    this.currentTest = '';
                    this.currentSpeed = 0;
                }, 1000);
            }
        },

        async testTimedUploadSpeed() {
            const testDuration = 5000; // 5秒测试
            const testDataSize = 100 * 1024 * 1024; // 100MB 测试数据
            
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const testData = new Uint8Array(testDataSize);
                const xhr = new XMLHttpRequest();
                let isUploadStopped = false;
                
                // 更新UI显示
                this.currentTest = `正在上传大文件进行 ${testDuration/1000} 秒测试...`;
                this.currentSpeed = 0;
                
                console.log(`开始定时上传测试: ${testDataSize/1024/1024}MB, 测试时长: ${testDuration/1000}秒`);
                
                // 5秒后停止上传
                const stopTimer = setTimeout(() => {
                    if (!isUploadStopped) {
                        isUploadStopped = true;
                        console.log('5秒时间到，停止上传');
                        xhr.abort(); // 停止上传
                        
                        // 等待一下让服务器端处理完成，然后请求结果
                        setTimeout(() => {
                            this.fetchUploadSpeed()
                                .then(result => {
                                    console.log('成功获取上传速度:', result);
                                    resolve(result);
                                })
                                .catch(err => {
                                    console.log('获取上传速度失败:', err);
                                    reject(new Error('获取上传速度失败'));
                                });
                        }, 1000); // 等待1秒让服务器端处理
                    }
                }, testDuration);
                
                xhr.addEventListener('load', () => {
                    if (!isUploadStopped) {
                        clearTimeout(stopTimer);
                        isUploadStopped = true;
                        
                        if (xhr.status === 200) {
                            try {
                                const result = JSON.parse(xhr.responseText);
                                if (result.success) {
                                    console.log(`上传完成: ${Math.round(result.speedBps/1024)} KB/s`);
                                    resolve(result);
                                } else {
                                    reject(new Error(result.error || '上传测试失败'));
                                }
                            } catch (e) {
                                reject(new Error('解析响应失败'));
                            }
                        } else {
                            reject(new Error(`上传测试失败: ${xhr.status}`));
                        }
                    }
                });
                
                xhr.addEventListener('error', () => {
                    if (!isUploadStopped) {
                        clearTimeout(stopTimer);
                        isUploadStopped = true;
                        reject(new Error('网络错误'));
                    }
                });
                
                xhr.addEventListener('abort', () => {
                    // 上传被主动停止，这是正常的
                    console.log('上传被主动停止');
                });
                
                // 使用简化的上传API
                xhr.open('POST', '/api/speedtest/upload');
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                xhr.setRequestHeader('Content-Length', testDataSize.toString());
                xhr.timeout = 60000; // 60秒超时
                xhr.send(testData);
            });
        },

        async fetchUploadSpeed() {
            try {
                const response = await fetch('/api/speedtest/upload-speed');
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        return result;
                    } else {
                        throw new Error(result.error || '获取上传速度失败');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                throw new Error(`无法从服务器获取上传速度: ${error.message}`);
            }
        },

        resetResults() {
            this.results = null;
            this.error = null;
            this.progress = 0;
            this.currentTest = '';
            this.currentSpeed = 0;
        },

        formatSpeed(bytesPerSecond) {
            if (bytesPerSecond >= 1024 * 1024) {
                // 大于等于1MB/s，显示MB/s
                const mbps = bytesPerSecond / (1024 * 1024);
                return `${Math.round(mbps * 100) / 100} MB/s`;
            } else if (bytesPerSecond >= 1024) {
                // 大于等于1KB/s，显示KB/s
                const kbps = bytesPerSecond / 1024;
                return `${Math.round(kbps * 100) / 100} KB/s`;
            } else {
                // 小于1KB/s，显示B/s
                return `${Math.round(bytesPerSecond)} B/s`;
            }
        }
    }
};
</script>

<style scoped>
.speedtest-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

.test-controls {
    margin: 20px 0;
    display: flex;
    gap: 10px;
}

.download-btn, .upload-btn, .reset-btn {
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.3s ease;
}

.download-btn {
    background-color: #28a745;
    color: white;
}

.download-btn:hover:not(:disabled) {
    background-color: #218838;
}

.download-btn:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
}

.upload-btn {
    background-color: #007bff;
    color: white;
}

.upload-btn:hover:not(:disabled) {
    background-color: #0056b3;
}

.upload-btn:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
}


.reset-btn {
    background-color: #6c757d;
    color: white;
}

.reset-btn:hover:not(:disabled) {
    background-color: #545b62;
}

.progress-section {
    margin: 20px 0;
}

.progress-bar {
    width: 100%;
    height: 20px;
    background-color: #e9ecef;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 10px;
}

.progress-fill {
    height: 100%;
    background-color: #007bff;
    transition: width 0.3s ease;
}

.progress-text {
    text-align: center;
    color: #6c757d;
    margin: 0;
}

.current-speed {
    text-align: center;
    margin-top: 10px;
    padding: 8px 16px;
    background-color: #e3f2fd;
    border-radius: 6px;
    border: 1px solid #bbdefb;
}

.speed-label {
    color: #1976d2;
    font-weight: 500;
    margin-right: 8px;
}

.speed-value {
    color: #0d47a1;
    font-weight: bold;
    font-size: 16px;
}

.results-section {
    margin: 30px 0;
    padding: 20px;
    background-color: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #dee2e6;
}

.result-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 20px 0;
}

.result-item {
    text-align: center;
    padding: 15px;
    background-color: white;
    border-radius: 6px;
    border: 1px solid #dee2e6;
}

.result-label {
    font-size: 14px;
    color: #6c757d;
    margin-bottom: 8px;
}

.result-value {
    font-size: 24px;
    font-weight: bold;
    color: #007bff;
    margin-bottom: 4px;
}

.result-detail {
    font-size: 12px;
    color: #6c757d;
}

.result-timestamp {
    text-align: center;
    color: #6c757d;
    font-size: 14px;
    margin-top: 15px;
}

.error-section {
    margin: 20px 0;
    padding: 15px;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    color: #721c24;
}

.error-section h4 {
    margin: 0 0 10px 0;
    color: #721c24;
}

.error-section p {
    margin: 0;
}

@media (max-width: 768px) {
    .result-grid {
        grid-template-columns: 1fr;
    }
    
    .test-controls {
        flex-direction: column;
    }
}
</style>
