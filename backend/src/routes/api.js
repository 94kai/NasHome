const express = require('express');
const { query, get, run } = require('../models/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 获取工具列表
router.get('/tools', optionalAuth, async (req, res) => {
  try {
    const tools = await query(`
      SELECT id, name, description, url, icon, category, is_active, created_at 
      FROM tools 
      WHERE is_active = 1 
      ORDER BY category, name
    `);

    res.json({
      success: true,
      data: tools
    });
  } catch (error) {
    console.error('获取工具列表错误:', error);
    res.status(500).json({ error: '获取工具列表失败' });
  }
});

// 添加新工具
router.post('/tools', authenticateToken, async (req, res) => {
  try {
    const { name, description, url, icon, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: '工具名称不能为空' });
    }

    const result = await run(
      'INSERT INTO tools (name, description, url, icon, category) VALUES (?, ?, ?, ?, ?)',
      [name, description || '', url || '', icon || '🔧', category || 'other']
    );

    const newTool = await get('SELECT * FROM tools WHERE id = ?', [result.id]);

    res.status(201).json({
      success: true,
      message: '工具添加成功',
      data: newTool
    });
  } catch (error) {
    console.error('添加工具错误:', error);
    res.status(500).json({ error: '添加工具失败' });
  }
});

// 更新工具
router.put('/tools/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, url, icon, category, is_active } = req.body;

    const result = await run(
      'UPDATE tools SET name = ?, description = ?, url = ?, icon = ?, category = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, url, icon, category, is_active, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: '工具不存在' });
    }

    const updatedTool = await get('SELECT * FROM tools WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '工具更新成功',
      data: updatedTool
    });
  } catch (error) {
    console.error('更新工具错误:', error);
    res.status(500).json({ error: '更新工具失败' });
  }
});

// 删除工具
router.delete('/tools/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await run('DELETE FROM tools WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: '工具不存在' });
    }

    res.json({
      success: true,
      message: '工具删除成功'
    });
  } catch (error) {
    console.error('删除工具错误:', error);
    res.status(500).json({ error: '删除工具失败' });
  }
});

// 获取系统信息
router.get('/system', optionalAuth, async (req, res) => {
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
    res.status(500).json({ error: '获取系统信息失败' });
  }
});

// 获取日志
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, level } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM logs';
    let params = [];

    if (level) {
      sql += ' WHERE level = ?';
      params.push(level);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = await query(sql, params);
    const total = await get(`SELECT COUNT(*) as count FROM logs${level ? ' WHERE level = ?' : ''}`, level ? [level] : []);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total.count,
          pages: Math.ceil(total.count / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取日志错误:', error);
    res.status(500).json({ error: '获取日志失败' });
  }
});

// API文档
router.get('/', (req, res) => {
  res.json({
    name: 'NAS Tools API',
    version: '1.0.0',
    description: '简易NAS工具服务端API',
    endpoints: {
      auth: {
        'POST /api/auth/login': '用户登录',
        'POST /api/auth/register': '用户注册',
        'GET /api/auth/me': '获取当前用户信息'
      },
      tools: {
        'GET /api/tools': '获取工具列表',
        'POST /api/tools': '添加新工具 (需要认证)',
        'PUT /api/tools/:id': '更新工具 (需要认证)',
        'DELETE /api/tools/:id': '删除工具 (需要认证)'
      },
      system: {
        'GET /api/system': '获取系统信息',
        'GET /api/logs': '获取系统日志 (需要认证)'
      }
    },
    usage: {
      authentication: '在请求头中添加: Authorization: Bearer <your-token>',
      defaultUser: '用户名: admin, 密码: admin123'
    }
  });
});

module.exports = router;
