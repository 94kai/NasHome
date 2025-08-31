const axios = require('axios');

// 启用磁盘空间插件的函数
async function enableDiskSpacePlugin() {
  try {
    // 首先登录获取token
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'password'
    });

    const token = loginResponse.data.token;
    console.log('登录成功，获取到token:', token);

    // 调用API启用磁盘空间插件
    const response = await axios.post(
      'http://localhost:3000/api/plugins/disk-space/toggle',
      { enabled: true },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    console.log('启用磁盘空间插件成功:', response.data);
  } catch (error) {
    console.error('操作失败:', error.response ? error.response.data : error.message);
  }
}

enableDiskSpacePlugin();

