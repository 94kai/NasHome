const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './database/nas-tools.db';

// 确保数据库目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

// 初始化数据库表
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 用户表
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 工具表 - 存储你的小工具信息
      db.run(`
        CREATE TABLE IF NOT EXISTS tools (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          url TEXT,
          icon TEXT,
          category TEXT DEFAULT 'other',
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 系统日志表
      db.run(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          user_id INTEGER,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // 插入默认管理员用户
      db.get("SELECT COUNT(*) as count FROM users WHERE username = 'admin'", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          const bcrypt = require('bcryptjs');
          const hashedPassword = bcrypt.hashSync('admin123', 10);
          
          db.run(
            "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
            ['admin', hashedPassword, 'admin@nas.local'],
            (err) => {
              if (err) {
                reject(err);
              } else {
                console.log('✅ 默认管理员用户创建成功 (用户名: admin, 密码: admin123)');
                resolve();
              }
            }
          );
        } else {
          resolve();
        }
      });

      // 插入示例工具数据
      db.run(`
        INSERT OR IGNORE INTO tools (name, description, url, icon, category) VALUES 
        ('文件管理', '浏览和管理NAS文件', '/file-manager', '📁', 'file'),
        ('下载中心', '管理下载任务', '/downloads', '⬇️', 'download'),
        ('系统监控', '查看系统状态', '/monitor', '📊', 'system'),
        ('设置中心', '系统配置管理', '/settings', '⚙️', 'config')
      `, (err) => {
        if (err) {
          console.log('⚠️ 示例工具数据插入失败:', err.message);
        } else {
          console.log('✅ 示例工具数据插入成功');
        }
      });
    });
  });
}

// 数据库查询封装
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

module.exports = {
  db,
  initDatabase,
  query,
  get,
  run
};
