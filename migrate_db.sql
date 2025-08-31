-- SQLite数据库迁移脚本
-- 用于从包含email字段的users表迁移到不包含email字段的新表

-- 1. 重命名旧表
ALTER TABLE users RENAME TO users_old;

-- 2. 创建新的users表（不包含email字段）
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 3. 将旧表数据迁移到新表（不包含email字段）
INSERT INTO users (id, username, password, created_at)
SELECT id, username, password, created_at
FROM users_old;

-- 4. 删除旧表
DROP TABLE users_old;

-- 5. 检查迁移结果
.schema users
SELECT * FROM users;
