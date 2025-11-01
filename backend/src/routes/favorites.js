const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const { query, get, run } = require('../models/database');

// 与 fs.js 保持一致的根目录限制
const HOME_ROOT = path.resolve(process.env.FS_ROOT || os.homedir());
const HOME_ROOT_PREFIX = HOME_ROOT.endsWith(path.sep) ? HOME_ROOT : HOME_ROOT + path.sep;

function resolveSafe(rel) {
  const relNorm = (rel || '').toString().replace(/^\/+/, '');
  const abs = path.resolve(HOME_ROOT, relNorm);
  if (abs === HOME_ROOT) return abs;
  if (!abs.startsWith(HOME_ROOT_PREFIX) && abs !== HOME_ROOT) {
    const err = new Error('Path escapes root');
    err.code = 'OUT_OF_ROOT';
    throw err;
  }
  return abs;
}
function toRel(abs) {
  const rel = path.relative(HOME_ROOT, abs) || '';
  return rel.split(path.sep).join('/');
}
function baseName(p) {
  const parts = (p || '').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '/';
}

const router = express.Router();

// 列出收藏
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = await query('SELECT id, path, alias, created_at, updated_at FROM favorites WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
    const enriched = await Promise.all(rows.map(async (r) => {
      const rel = (r.path || '').toString().replace(/^\/+/, '');
      const abs = resolveSafe(rel);
      let type = 'other';
      let exists = true; // 默认认为存在，只有明确 ENOENT 时判定为不存在，避免误报
      try {
        const st = await fs.stat(abs);
        if (st.isDirectory()) type = 'dir';
        else if (st.isFile()) type = 'file';
      } catch (e) {
        if (e && e.code === 'ENOENT') exists = false;
      }
      return { id: r.id, path: toRel(abs), alias: r.alias || '', name: baseName(rel), type, exists };
    }));
    res.json({ items: enriched });
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('Favorites list error:', err);
    res.status(500).json({ error: '获取收藏失败' });
  }
});

// 新增收藏
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const relRaw = (body.path || '').toString();
    const alias = (body.alias || '').toString();
    if (!relRaw) return res.status(400).json({ error: '缺少path' });

    const rel = relRaw.replace(/^\/+/, '');
    const abs = resolveSafe(rel);
    let st;
    try { st = await fs.stat(abs); } catch (_) { return res.status(404).json({ error: '路径不存在' }); }

    const now = new Date().toISOString();
    let insert;
    try {
      insert = await run('INSERT INTO favorites (user_id, path, alias, created_at, updated_at) VALUES (?,?,?,?,?)', [req.user.id, rel, alias || null, now, now]);
    } catch (e) {
      if (e && (e.code === 'SQLITE_CONSTRAINT' || ('' + e.message).includes('UNIQUE'))) return res.status(409).json({ error: '已在收藏中' });
      throw e;
    }
    const type = st.isDirectory() ? 'dir' : (st.isFile() ? 'file' : 'other');
    res.status(201).json({ id: insert && insert.id, path: toRel(abs), alias: alias || '', name: baseName(rel), type });
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('Favorites create error:', err);
    res.status(500).json({ error: '添加收藏失败' });
  }
});

// 更新别名
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ error: '参数错误' });
    const alias = ((req.body && req.body.alias) || '').toString();
    const row = await get('SELECT id FROM favorites WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!row) return res.status(404).json({ error: '收藏不存在' });
    const now = new Date().toISOString();
    await run('UPDATE favorites SET alias = ?, updated_at = ? WHERE id = ? AND user_id = ?', [alias || null, now, id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Favorites update error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除收藏
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ error: '参数错误' });
    const result = await run('DELETE FROM favorites WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result || !result.changes) return res.status(404).json({ error: '收藏不存在' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Favorites delete error:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
