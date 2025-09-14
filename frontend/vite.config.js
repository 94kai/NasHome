import {
    defineConfig
} from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    // 测试时起这个服务，代理到2000访问后端。生产环境前端通过后端静态资源访问，直接访问服务端
    server: {
        host: '::',
        proxy: {
            '/api': {
                target: 'http://localhost:2000',
                changeOrigin: true,
            }
        },
    allowedHosts: [
        'home.xuekai.top'
    ]
    },
});
