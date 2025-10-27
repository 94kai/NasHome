const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs').promises;
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Base root for browsing; defaults to the system home directory
const HOME_ROOT = path.resolve(process.env.FS_ROOT || os.homedir());
// Prefix used to validate child paths stay under HOME_ROOT.
// Use a safe prefix that works when HOME_ROOT is '/' (avoid creating '//').
const HOME_ROOT_PREFIX = HOME_ROOT.endsWith(path.sep) ? HOME_ROOT : HOME_ROOT + path.sep;

// Whitelist of text extensions allowed for inline preview
const ALLOWED_TEXT_EXT = new Set([
  '.txt', '.md', '.markdown', '.log', '.json', '.js', '.mjs', '.cjs', '.ts',
  '.py', '.sh', '.yaml', '.yml', '.xml', '.html', '.htm', '.css', '.ini',
  '.conf', '.cfg', '.env', '.gitignore', '.dockerignore', '.gradle', '.properties'
]);
const ALLOWED_TEXT_NAMES = new Set([
  // common shells & dotfiles
  '.bashrc', '.bash_profile', '.bash_aliases', '.profile', '.zshrc', '.gitconfig',
  '.npmrc', '.yarnrc', '.tmux.conf', '.editorconfig', '.gitignore',
  // editors & config
  '.vimrc', 'vimrc', '.editorconfig', 'Dockerfile', 'Makefile', 'CMakeLists.txt',
  'README', 'LICENSE', 'CHANGELOG', 'NOTICE', 'Procfile'
]);

const MAX_PREVIEW_BYTES = parseInt(process.env.FS_MAX_PREVIEW || '2097152', 10); // 2MB
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Ensure the target absolute path is within HOME_ROOT
function resolveSafe(rel) {
  const relNorm = (rel || '').replace(/^\/+/, ''); // strip leading slashes
  const abs = path.resolve(HOME_ROOT, relNorm);
  if (abs === HOME_ROOT) return abs;
  // Ensure `abs` does not escape HOME_ROOT. When HOME_ROOT is '/',
  // use HOME_ROOT_PREFIX to avoid the '//' mismatch.
  if (!abs.startsWith(HOME_ROOT_PREFIX) && abs !== HOME_ROOT) {
    const err = new Error('Path escapes root');
    err.code = 'OUT_OF_ROOT';
    throw err;
  }
  return abs;
}

function toRel(abs) {
  const rel = path.relative(HOME_ROOT, abs) || '';
  // Normalize to posix style for frontend
  return rel.split(path.sep).join('/');
}

function isAllowedTextFile(name) {
  const ext = path.extname(name).toLowerCase();
  if (ALLOWED_TEXT_EXT.has(ext)) return true;
  const base = path.basename(name);
  return ALLOWED_TEXT_NAMES.has(base);
}

// Basic image detection by extension
const IMAGE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tif', '.tiff', '.avif'
]);

// Basic video detection by extension
const VIDEO_EXT = new Set([
  '.mp4', '.m4v', '.mkv', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.wmv', '.ts', '.m2ts', '.3gp'
]);
function isImageFile(name) {
  const ext = path.extname(name).toLowerCase();
  return IMAGE_EXT.has(ext);
}

function isVideoFile(name) {
  const ext = path.extname(name).toLowerCase();
  return VIDEO_EXT.has(ext);
}

// Minimal content-type mapping to avoid pulling extra deps
function contentTypeFor(name) {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.bmp': return 'image/bmp';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    case '.tif':
    case '.tiff': return 'image/tiff';
    case '.avif': return 'image/avif';
    // Video
    case '.mp4':
    case '.m4v': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.ogv':
    case '.ogg': return 'video/ogg';
    case '.mov': return 'video/quicktime';
    case '.mkv': return 'video/x-matroska';
    case '.avi': return 'video/x-msvideo';
    case '.wmv': return 'video/x-ms-wmv';
    case '.ts':
    case '.m2ts': return 'video/mp2t';
    case '.3gp': return 'video/3gpp';
    default: return 'application/octet-stream';
  }
}

// Heuristic: check a small sample to see if file looks like text (no NUL, low control ratio)
async function looksLikeTextFile(abs, size) {
  try {
    const sampleSize = Math.min(size, 8192);
    const fh = await fsp.open(abs, 'r');
    try {
      const { buffer, bytesRead } = await fh.read(Buffer.alloc(sampleSize), 0, sampleSize, 0);
      if (bytesRead === 0) return true; // empty file -> text
      let control = 0;
      for (let i = 0; i < bytesRead; i++) {
        const b = buffer[i];
        if (b === 0x00) return false; // NUL -> binary
        if (b < 32 && b !== 9 && b !== 10 && b !== 13) control++;
      }
      const ratio = control / bytesRead;
      return ratio < 0.02; // allow minimal control chars
    } finally {
      await fh.close();
    }
  } catch (_) {
    return false;
  }
}

// GET /api/fs/list?path=relative/path
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const rel = (req.query.path || '').toString();
    const dirAbs = resolveSafe(rel);

    let dirStat;
    try {
      dirStat = await fsp.stat(dirAbs);
    } catch (e) {
      return res.status(404).json({ error: '路径不存在' });
    }

    if (!dirStat.isDirectory()) {
      return res.status(400).json({ error: '不是目录' });
    }

    const entries = await fsp.readdir(dirAbs, { withFileTypes: true });

    const items = await Promise.all(entries.map(async (dirent) => {
      const name = dirent.name;
      const abs = path.join(dirAbs, name);
      let stat;
      try {
        // Follow symlink to determine final type
        stat = await fsp.stat(abs);
      } catch (_) {
        // Broken symlink or permission issue; try lstat to get some info
        try {
          stat = await fsp.lstat(abs);
        } catch (e) {
          return null; // skip unreadable entries
        }
      }

      const realAbs = path.resolve(abs);
      // Hide items that resolve outside of HOME_ROOT
      if (!realAbs.startsWith(HOME_ROOT_PREFIX) && realAbs !== HOME_ROOT) {
        return null;
      }

      const type = stat.isDirectory() ? 'dir' : (stat.isFile() ? 'file' : 'other');
      const relPath = toRel(abs);
      const isText = type === 'file' ? isAllowedTextFile(name) : false;
      const isImage = type === 'file' ? isImageFile(name) : false;
      const isVideo = type === 'file' ? isVideoFile(name) : false;

      return {
        name,
        path: relPath,
        type,
        size: stat.size || 0,
        isText,
        isImage,
        isVideo
      };
    }));

    // Filter out skipped entries
    const clean = items.filter(Boolean);
    // Sort: directories first, then files, alphabetical
    clean.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    const parentAbs = path.dirname(dirAbs);
    const parentRel = dirAbs === HOME_ROOT ? null : toRel(parentAbs);

    res.json({
      root: '/',
      path: toRel(dirAbs),
      parent: parentRel,
      items: clean
    });
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') {
      return res.status(400).json({ error: '路径越界' });
    }
    console.error('FS list error:', err);
    res.status(500).json({ error: '读取目录失败' });
  }
});

// GET /api/fs/read?path=relative/file
router.get('/read', authenticateToken, async (req, res) => {
  try {
    const rel = (req.query.path || '').toString();
    const abs = resolveSafe(rel);
    let stat;
    try {
      stat = await fsp.stat(abs);
    } catch (e) {
      return res.status(404).json({ error: '文件不存在' });
    }

    if (!stat.isFile()) {
      return res.status(400).json({ error: '不是文件' });
    }

    const name = path.basename(abs);

    if (!isAllowedTextFile(name)) {
      const looksText = await looksLikeTextFile(abs, stat.size);
      if (!looksText) {
        return res.status(415).json({ error: '仅支持预览文本文件' });
      }
    }

    if (stat.size > MAX_PREVIEW_BYTES) {
      return res.status(413).json({ error: '文件过大，无法预览', size: stat.size });
    }

    // Read as UTF-8 text. If decoding fails, Node will throw.
    const content = await fsp.readFile(abs, 'utf8');

    res.json({
      name,
      path: toRel(abs),
      size: stat.size,
      content
    });
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') {
      return res.status(400).json({ error: '路径越界' });
    }
    console.error('FS read error:', err);
    res.status(500).json({ error: '读取文件失败' });
  }
});

// GET /api/fs/stat?path=relative/path
// Returns basic stat info (no hashing by default)
router.get('/stat', authenticateToken, async (req, res) => {
  try {
    const rel = (req.query.path || '').toString();
    const abs = resolveSafe(rel);
    let st;
    try { st = await fsp.stat(abs); } catch (e) { return res.status(404).json({ error: '路径不存在' }); }

    const isDir = st.isDirectory();
    const type = isDir ? 'dir' : (st.isFile() ? 'file' : 'other');
    const name = path.basename(abs);
  const payload = {
      name,
      path: toRel(abs),
      type,
      size: st.size,
      mtime: st.mtimeMs ? new Date(st.mtimeMs).toISOString() : null,
      ctime: st.ctimeMs ? new Date(st.ctimeMs).toISOString() : null,
      isText: !isDir && st.isFile() ? isAllowedTextFile(name) : false,
      isImage: !isDir && st.isFile() ? isImageFile(name) : false,
      isVideo: !isDir && st.isFile() ? isVideoFile(name) : false
    };
    res.json(payload);
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('FS stat error:', err);
    res.status(500).json({ error: '获取文件信息失败' });
  }
});

// GET /api/fs/hash?path=relative/file&algo=md5
// Streams the file to compute hash; supports md5 (default). Intended for on-demand checks.
router.get('/hash', authenticateToken, async (req, res) => {
  try {
    const rel = (req.query.path || '').toString();
    const algo = ((req.query.algo || 'md5') + '').toLowerCase();
    if (!['md5'].includes(algo)) {
      return res.status(400).json({ error: '不支持的哈希算法' });
    }
    const abs = resolveSafe(rel);
    let st;
    try { st = await fsp.stat(abs); } catch (e) { return res.status(404).json({ error: '文件不存在' }); }
    if (!st.isFile()) return res.status(400).json({ error: '不是文件' });

    const h = crypto.createHash(algo);
    const s = fs.createReadStream(abs);
    s.on('data', chunk => h.update(chunk));
    s.on('error', (e) => {
      console.error('FS hash stream error:', e);
      if (!res.headersSent) res.status(500).json({ error: '计算哈希失败' });
    });
    s.on('end', () => {
      const value = h.digest('hex');
      res.json({ algo, value, size: st.size, path: toRel(abs) });
    });
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('FS hash error:', err);
    res.status(500).json({ error: '计算哈希失败' });
  }
});

// GET /api/fs/download?path=relative/file
// Sends the file as an attachment for download. Works for any file type within HOME_ROOT.
router.get('/download', authenticateToken, async (req, res) => {
  try {
    const rel = (req.query.path || '').toString();
    const abs = resolveSafe(rel);

    let stat;
    try {
      stat = await fsp.stat(abs);
    } catch (e) {
      return res.status(404).json({ error: '文件不存在' });
    }

    if (!stat.isFile()) {
      return res.status(400).json({ error: '不是文件' });
    }

    const name = path.basename(abs);
    const withBOM = req.query.bom === '1' && isAllowedTextFile(name);

    res.setHeader('Cache-Control', 'no-store');
    if (withBOM) {
      // Set disposition and explicit UTF-8 text content type for better mobile detection
      res.attachment(name);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      // Write BOM then stream the file bytes
      res.write(Buffer.from([0xEF, 0xBB, 0xBF]));
      const stream = fs.createReadStream(abs);
      stream.on('error', (err) => {
        if (!res.headersSent) res.status(500).json({ error: '下载失败' });
        else try { res.end(); } catch (_) {}
      });
      stream.pipe(res);
    } else {
      // Use Express helper to set Content-Disposition and stream file
      res.download(abs, name, (err) => {
        if (err) {
          if (!res.headersSent) {
            res.status(500).json({ error: '下载失败' });
          }
        }
      });
    }
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') {
      return res.status(400).json({ error: '路径越界' });
    }
    console.error('FS download error:', err);
    res.status(500).json({ error: '下载失败' });
  }
});

// GET /api/fs/preview?path=relative/file
// Streams image content inline with appropriate Content-Type; requires auth
router.get('/preview', authenticateToken, async (req, res) => {
  try {
    const rel = (req.query.path || '').toString();
    const abs = resolveSafe(rel);

    let stat;
    try { stat = await fsp.stat(abs); } catch (e) { return res.status(404).json({ error: '文件不存在' }); }
    if (!stat.isFile()) return res.status(400).json({ error: '不是文件' });

    const name = path.basename(abs);
    if (!isImageFile(name)) return res.status(415).json({ error: '仅支持预览图片' });

    const ct = contentTypeFor(name);
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-store');
    const stream = fs.createReadStream(abs);
    stream.on('error', (err) => {
      console.error('FS preview stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: '预览失败' });
    });
    stream.pipe(res);
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('FS preview error:', err);
    res.status(500).json({ error: '预览失败' });
  }
});

// GET /api/fs/stream?path=relative/file
// Streams video content with HTTP Range support; requires auth
router.get('/stream', authenticateToken, async (req, res) => {
  try {
    const rel = (req.query.path || '').toString();
    const abs = resolveSafe(rel);

    let stat;
    try { stat = await fsp.stat(abs); } catch { return res.status(404).json({ error: '文件不存在' }); }
    if (!stat.isFile()) return res.status(400).json({ error: '不是文件' });

    const name = path.basename(abs);
    const size = stat.size || 0;
    const ct = contentTypeFor(name);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    const range = req.headers.range;
    if (range) {
      // Parse simple bytes range: bytes=start-end
      const m = /^bytes=(\d+)-(\d+)?$/.exec(range);
      if (!m) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      let start = parseInt(m[1], 10);
      let end = m[2] ? parseInt(m[2], 10) : (size - 1);
      if (isNaN(start) || isNaN(end) || start > end || start >= size) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      end = Math.min(end, size - 1);
      const chunkSize = (end - start) + 1;
      res.status(206);
      res.setHeader('Content-Type', ct);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', chunkSize);
      const stream = fs.createReadStream(abs, { start, end });
      stream.on('error', (err) => {
        console.error('FS stream range error:', err);
        try { res.end(); } catch (_) {}
      });
      return stream.pipe(res);
    }

    // No range -> stream whole file
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Length', size);
    const stream = fs.createReadStream(abs);
    stream.on('error', (err) => {
      console.error('FS stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: '流式播放失败' });
    });
    return stream.pipe(res);
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('FS stream error:', err);
    res.status(500).json({ error: '流式播放失败' });
  }
});

// POST /api/fs/sign  { path: 'relative/file', ttl?: seconds }
// Returns a short-lived signed URL that can be used without Authorization header
router.post('/sign', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const rel = (body.path || '').toString();
    const ttl = Math.min(Math.max(parseInt(body.ttl || '120', 10) || 120, 10), 3600); // 10s - 1h
    const mode = ((body.mode || 'download') + '').toLowerCase(); // 'download' | 'preview' | 'stream'
    const abs = resolveSafe(rel);

    let stat;
    try { stat = await fsp.stat(abs); } catch { return res.status(404).json({ error: '文件不存在' }); }
    if (!stat.isFile()) return res.status(400).json({ error: '不是文件' });

    // Token subject reflects mode for stricter validation
    const payload = {
      sub: mode === 'stream' ? 'fsstream' : 'fsdl',
      path: toRel(abs),
      uid: req.user && req.user.id
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: ttl });
    const endpoint = mode === 'preview' ? '/api/fs/preview-signed' : (mode === 'stream' ? '/api/fs/stream-signed' : '/api/fs/download-signed');
    const url = `${endpoint}?token=${encodeURIComponent(token)}`;
    const expiresAt = Date.now() + ttl * 1000;
    res.json({ url, expiresAt });
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('FS sign error:', err);
    res.status(500).json({ error: '生成签名链接失败' });
  }
});

// GET /api/fs/download-signed?token=...
// No Authorization header required; token must be valid and not expired
router.get('/download-signed', async (req, res) => {
  try {
    const token = (req.query.token || '').toString();
    if (!token) return res.status(400).json({ error: '缺少token' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: '无效或过期的token' });
    }

    if (decoded.sub !== 'fsdl' || !decoded.path) return res.status(400).json({ error: '非法token' });

    const abs = resolveSafe(decoded.path);
    let stat;
    try { stat = await fsp.stat(abs); } catch { return res.status(404).json({ error: '文件不存在' }); }
    if (!stat.isFile()) return res.status(400).json({ error: '不是文件' });

    const name = path.basename(abs);
    const withBOM = req.query.bom === '1' && isAllowedTextFile(name);
    res.setHeader('Cache-Control', 'no-store');
    if (withBOM) {
      res.attachment(name);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.write(Buffer.from([0xEF, 0xBB, 0xBF]));
      const stream = fs.createReadStream(abs);
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).json({ error: '下载失败' });
        else try { res.end(); } catch (_) {}
      });
      stream.pipe(res);
    } else {
      res.download(abs, name, (err) => {
        if (err && !res.headersSent) res.status(500).json({ error: '下载失败' });
      });
    }
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('FS download-signed error:', err);
    res.status(500).json({ error: '下载失败' });
  }
});

// GET /api/fs/preview-signed?token=...
// Streams image content inline without requiring Authorization header
router.get('/preview-signed', async (req, res) => {
  try {
    const token = (req.query.token || '').toString();
    if (!token) return res.status(400).json({ error: '缺少token' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: '无效或过期的token' });
    }

    if (decoded.sub !== 'fsdl' || !decoded.path) return res.status(400).json({ error: '非法token' });

    const abs = resolveSafe(decoded.path);
    let stat;
    try { stat = await fsp.stat(abs); } catch { return res.status(404).json({ error: '文件不存在' }); }
    if (!stat.isFile()) return res.status(400).json({ error: '不是文件' });

    const name = path.basename(abs);
    if (!isImageFile(name)) return res.status(415).json({ error: '仅支持预览图片' });

    const ct = contentTypeFor(name);
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-store');
    const stream = fs.createReadStream(abs);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).json({ error: '预览失败' });
    });
    stream.pipe(res);
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('FS preview-signed error:', err);
    res.status(500).json({ error: '预览失败' });
  }
});

// GET /api/fs/stream-signed?token=...
// Streams video content inline without requiring Authorization header
router.get('/stream-signed', async (req, res) => {
  try {
    const token = (req.query.token || '').toString();
    if (!token) return res.status(400).json({ error: '缺少token' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: '无效或过期的token' });
    }

    if (decoded.sub !== 'fsstream' || !decoded.path) return res.status(400).json({ error: '非法token' });

    const abs = resolveSafe(decoded.path);
    let stat;
    try { stat = await fsp.stat(abs); } catch { return res.status(404).json({ error: '文件不存在' }); }
    if (!stat.isFile()) return res.status(400).json({ error: '不是文件' });

    const name = path.basename(abs);
    const size = stat.size || 0;
    const ct = contentTypeFor(name);

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d+)-(\d+)?$/.exec(range);
      if (!m) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      let start = parseInt(m[1], 10);
      let end = m[2] ? parseInt(m[2], 10) : (size - 1);
      if (isNaN(start) || isNaN(end) || start > end || start >= size) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      end = Math.min(end, size - 1);
      const chunkSize = (end - start) + 1;
      res.status(206);
      res.setHeader('Content-Type', ct);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', chunkSize);
      const stream = fs.createReadStream(abs, { start, end });
      stream.on('error', (err) => {
        console.error('FS stream-signed range error:', err);
        try { res.end(); } catch (_) {}
      });
      return stream.pipe(res);
    }

    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Length', size);
    const stream = fs.createReadStream(abs);
    stream.on('error', (err) => {
      console.error('FS stream-signed error:', err);
      if (!res.headersSent) res.status(500).json({ error: '流式播放失败' });
    });
    return stream.pipe(res);
  } catch (err) {
    if (err && err.code === 'OUT_OF_ROOT') return res.status(400).json({ error: '路径越界' });
    console.error('FS stream-signed error:', err);
    res.status(500).json({ error: '流式播放失败' });
  }
});

module.exports = router;
