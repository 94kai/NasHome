const express = require('express');
const bcrypt = require('bcryptjs');
const {
    get,
    run
} = require('../models/database');
const {
    generateToken
} = require('../middleware/auth');

const router = express.Router();

// 用户登录
router.post('/login', async (req, res) => {
    try {
        const {
            username,
            password
        } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: '用户名和密码不能为空'
            });
        }

        // 查找用户
        const user = await get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({
                error: '用户名或密码错误'
            });
        }

        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                error: '用户名或密码错误'
            });
        }

        // 生成Token
        const token = generateToken(user);

        res.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({
            error: '登录失败'
        });
    }
});

// 用户注册
router.post('/register', async (req, res) => {
    try {
        const {
            username,
            password,
            email
        } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: '用户名和密码不能为空'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: '密码长度至少6位'
            });
        }

        // 检查用户名是否已存在
        const existingUser = await get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(400).json({
                error: '用户名已存在'
            });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建用户
        const result = await run(
            'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
            [username, hashedPassword, email || null]
        );

        res.status(201).json({
            message: '注册成功',
            user: {
                id: result.id,
                username,
                email
            }
        });

    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({
            error: '注册失败'
        });
    }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: '需要登录'
            });
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

        const user = await get('SELECT id, username, email, created_at FROM users WHERE id = ?', [decoded.id]);
        if (!user) {
            return res.status(404).json({
                error: '用户不存在'
            });
        }

        res.json({
            user
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(401).json({
            error: 'Token无效'
        });
    }
});

module.exports = router;
