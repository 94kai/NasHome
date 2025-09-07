const express = require('express');
const { query, get, run } = require('../models/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { getToolRegistry } = require('../config/tools');

const router = express.Router();

// 获取工具列表
router.get('/tools', optionalAuth, async (req, res) => {
  try {
    const { category, active_only = 'true' } = req.query;
    const toolRegistry = getToolRegistry();
    
    let tools;
    if (category) {
      // 按分类获取工具
      tools = toolRegistry.getToolsByCategory(category, active_only === 'true');
    } else {
      // 获取所有工具
      tools = toolRegistry.getAllTools(active_only === 'true');
    }

    // 按分类和名称排序
    tools.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    res.json({
      success: true,
      data: tools
    });
  } catch (error) {
    console.error('获取工具列表错误:', error);
    res.status(500).json({ error: '获取工具列表失败' });
  }
});


// 获取工具分类列表
router.get('/tools/categories', optionalAuth, async (req, res) => {
  try {
    const toolRegistry = getToolRegistry();
    const categories = toolRegistry.getCategories();
    
    // 获取每个分类的工具数量
    const categoryStats = categories.map(category => {
      const tools = toolRegistry.getToolsByCategory(category);
      return {
        name: category,
        count: tools.length,
        activeCount: tools.filter(tool => tool.isActive).length
      };
    });

    res.json({
      success: true,
      data: categoryStats
    });
  } catch (error) {
    console.error('获取工具分类错误:', error);
    res.status(500).json({ error: '获取工具分类失败' });
  }
});

// 获取工具统计信息
router.get('/tools/stats', optionalAuth, async (req, res) => {
  try {
    const toolRegistry = getToolRegistry();
    const stats = toolRegistry.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取工具统计错误:', error);
    res.status(500).json({ error: '获取工具统计失败' });
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
        'GET /api/tools/categories': '获取工具分类列表',
        'GET /api/tools/stats': '获取工具统计信息',
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
