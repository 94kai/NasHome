// NAS Tools 前端应用
let currentUser = null;
let authToken = null;

// 页面加载时检查是否已登录
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，开始检查认证状态');
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        console.log('发现缓存的token，验证中...');
        checkAuth();
    } else {
        console.log('没有token，显示登录表单');
        showLogin();
    }
});

// 检查认证状态
async function checkAuth() {
    try {
        console.log('发送认证验证请求...');
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            console.log('认证成功，用户:', currentUser.username);
            showDashboard();
            loadTools();
        } else {
            console.log('认证失败，清除token并显示登录');
            localStorage.removeItem('authToken');
            showLogin();
        }
    } catch (error) {
        console.error('认证检查失败:', error);
        showLogin();
    }
}

// 显示登录表单
function showLogin() {
    console.log('显示登录表单');
    document.getElementById('loginForm').classList.add('show');
    document.getElementById('dashboard').classList.remove('show');
}

// 显示仪表板
function showDashboard() {
    console.log('显示仪表板');
    document.getElementById('loginForm').classList.remove('show');
    document.getElementById('dashboard').classList.add('show');
    document.getElementById('usernameDisplay').textContent = currentUser.username;
}

// 显示消息
function showMessage(message, type = 'success') {
    console.log('显示消息:', message, type);
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 3000);
}

// 登录处理
document.getElementById('loginFormElement').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    console.log('尝试登录:', username);

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('登录成功');
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            showDashboard();
            loadTools();
            showMessage('登录成功！');
        } else {
            console.log('登录失败:', data.error);
            showMessage(data.error || '登录失败', 'error');
        }
    } catch (error) {
        console.error('登录错误:', error);
        showMessage('登录失败，请检查网络连接', 'error');
    }
});

// 退出登录
document.getElementById('logoutBtn').addEventListener('click', function() {
    console.log('用户退出登录');
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    showLogin();
    showMessage('已退出登录');
});

// 加载工具列表
async function loadTools() {
    try {
        console.log('加载工具列表...');
        const response = await fetch('/api/tools');
        const data = await response.json();

        if (data.success) {
            console.log('工具列表加载成功，数量:', data.data.length);
            displayTools(data.data);
        } else {
            console.log('工具列表加载失败');
            showMessage('加载工具列表失败', 'error');
        }
    } catch (error) {
        console.error('加载工具失败:', error);
        showMessage('加载工具列表失败', 'error');
    }
}

// 显示工具列表
function displayTools(tools) {
    console.log('显示工具列表:', tools);
    const toolsGrid = document.getElementById('toolsGrid');
    
    if (tools.length === 0) {
        toolsGrid.innerHTML = '<div class="tool-card"><div class="tool-name">暂无工具</div><div class="tool-description">还没有添加任何工具</div></div>';
        return;
    }

    toolsGrid.innerHTML = tools.map(tool => `
        <div class="tool-card" onclick="openTool('${tool.url || '#'}')">
            <div class="tool-icon">${tool.icon || '🔧'}</div>
            <div class="tool-name">${tool.name}</div>
            <div class="tool-description">${tool.description || '暂无描述'}</div>
        </div>
    `).join('');
}

// 打开工具
function openTool(url) {
    console.log('打开工具:', url);
    if (url && url !== '#') {
        window.open(url, '_blank');
    } else {
        showMessage('该工具暂未配置链接', 'error');
    }
}

// 全局函数，供HTML调用
window.openTool = openTool;

