const jwt = require('jsonwebtoken');
const { get } = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成JWT Token
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 验证JWT Token中间件
function authenticateToken(req, res, next) {
  console.log('authenticateToken');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '需要登录才能访问' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token无效或已过期' });
    }

    try {
      // 验证用户是否仍然存在
      const dbUser = await get('SELECT id, username, email FROM users WHERE id = ?', [user.id]);
      if (!dbUser) {
        return res.status(403).json({ error: '用户不存在' });
      }

      req.user = dbUser;
      next();
    } catch (error) {
      console.error('认证中间件错误:', error);
      res.status(500).json({ error: '认证验证失败' });
    }
  });
}

// 可选认证中间件（不强制要求登录）
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }

    try {
      const dbUser = await get('SELECT id, username, email FROM users WHERE id = ?', [user.id]);
      req.user = dbUser;
      next();
    } catch (error) {
      req.user = null;
      next();
    }
  });
}

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth
};
