import {
    createRouter,
    createWebHistory
} from 'vue-router';
import Login from '../components/Login.vue';
import Tool1 from '../components/tools/Tool1.vue';
import Tool2 from '../components/tools/Tool2.vue';
import Tool3 from '../components/tools/Tool3.vue';
import FileBrowser from '../components/tools/FileBrowser.vue';
import SpeedTest from '../components/tools/SpeedTest.vue';
import LinkDashboard from '../components/LinkDashboard.vue';

const routes = [{
        path: '/login',
        name: 'Login',
        component: Login
    },
    {
        path: '/links',
        name: 'Links',
        component: LinkDashboard
    },
    {
        path: '/tool1',
        name: 'Tool1',
        component: Tool1,
    },
    {
        path: '/tool2',
        name: 'Tool2',
        component: Tool2,
    },
    {
        path: '/tool3',
        name: 'Tool3',
        component: Tool3,
    },
    {
        path: '/files',
        name: 'FileBrowser',
        component: FileBrowser,
    },
    {
        path: '/speedtest',
        name: 'SpeedTest',
        component: SpeedTest,
    },
    {
        path: '/',
        redirect: '/links'
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach(async (to, from, next) => {
    const token = localStorage.getItem('token');

    // 如果目标路由不是登录页，且需要验证
    if (to.name !== 'Login') {
        if (token) {
            try {
                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    // Token有效，继续导航
                    next();
                } else {
                    // Token无效或过期
                    localStorage.removeItem('token');
                    next({
                        name: 'Login'
                    });
                }
            } catch (error) {
                // 网络错误等
                console.error('Authentication check failed:', error);
                localStorage.removeItem('token');
                next({
                    name: 'Login'
                });
            }
        } else {
            // 没有token，直接跳转到登录页
            next({
                name: 'Login'
            });
        }
    } else {
        // 如果是登录页，直接放行
        next();
    }
});
export default router;
