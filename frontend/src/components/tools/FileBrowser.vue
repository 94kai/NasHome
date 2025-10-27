<template>
  <div class="file-browser">
    <h3>文件浏览（Home）</h3>

    <div class="breadcrumbs">
      <span class="crumb" :class="{ active: currentPath === '' }" @click="goTo('')">/</span>
      <!-- Don't render an extra separator after root '/' to avoid '//' -->
      <!-- The per-segment loop will insert separators before idx>0 items -->
      <template v-for="(seg, idx) in breadcrumbSegments" :key="idx">
        <span class="sep" v-if="idx > 0">/</span>
        <span class="crumb" :class="{ active: idx === breadcrumbSegments.length - 1 }" @click="goTo(seg.path)">{{ seg.name }}</span>
      </template>
    </div>

    <div class="browser">
      <div class="pane left">
        <div class="toolbar">
          <button :disabled="parent === null" @click="goTo(parent)">上一级</button>
          <button @click="refresh">刷新</button>
          <button @click="goToHome">进入Home</button>
          <button @click="toggleHidden">{{ showHidden ? '隐藏隐藏文件' : '显示隐藏文件' }}</button>
        </div>
        <div class="list" v-if="items">
          <div v-for="it in displayedItems" :key="it.path"
               class="row"
               :class="{ dir: it.type==='dir', file: it.type==='file', clickable: it.type==='dir' || it.type==='file' }"
               @click="handleOpen(it)">
            <span class="icon">{{ it.type === 'dir' ? '📁' : (it.isText ? '📄' : '📦') }}</span>
            <span class="name">{{ it.name }}</span>
            <span class="actions" v-if="it.type==='file'">
              <button class="link-btn" title="更多" @click.stop="toggleMenu(it, $event)">更多 ▾</button>
            </span>
          </div>
        </div>
        <div v-else class="empty">加载中...</div>
      </div>
      <div class="pane right">
        <div v-if="fileContent" class="viewer">
          <div class="viewer-header">
            <span class="viewer-title">{{ fileTitle }}</span>
            <button @click="closePreview">关闭</button>
          </div>
          <pre class="content">{{ fileContent }}</pre>
        </div>
        <div v-else class="placeholder">选择一个文本文件进行预览</div>
      </div>
    </div>
    <!-- Info modal inside root -->
    <div v-if="infoOpen" class="modal" @click.self="infoOpen=false">
      <div class="modal-card">
        <div class="modal-header">
          <span>文件信息</span>
          <button class="link-btn" @click="infoOpen=false">关闭</button>
        </div>
        <div class="modal-body" v-if="infoLoading">加载中...</div>
        <div class="modal-body" v-else>
          <div class="kv"><span class="k">名称</span><span class="v">{{ infoData?.name }}</span></div>
          <div class="kv"><span class="k">路径</span><span class="v">{{ infoData?.path }}</span></div>
          <div class="kv"><span class="k">类型</span><span class="v">{{ infoData?.type }}</span></div>
          <div class="kv"><span class="k">大小</span><span class="v">{{ formatSize(infoData?.size) }}</span></div>
          <div class="kv"><span class="k">修改时间</span><span class="v">{{ formatTime(infoData?.mtime) }}</span></div>
          <div class="kv"><span class="k">MD5</span><span class="v">{{ infoData?.md5 || '-' }}</span></div>
        </div>
        <div class="modal-actions" v-if="infoData?.md5">
          <button class="link-btn" @click="copyMd5">复制MD5</button>
        </div>
      </div>
    </div>
    <!-- Floating menu rendered at viewport level to avoid clipping -->
    <div v-if="menuOpenFor && menuItem" class="menu-float" :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }" @click.stop>
      <button class="menu-item" @click="download(menuItem)">下载</button>
      <button class="menu-item" @click="copyLink(menuItem)">复制直链</button>
      <button v-if="menuItem.isText" class="menu-item" @click="download(menuItem, true)">下载(UTF-8+BOM)</button>
      <button v-if="menuItem.isText" class="menu-item" @click="copyLink(menuItem, true)">复制直链(UTF-8+BOM)</button>
      <button class="menu-item" @click="showInfo(menuItem)">文件信息</button>
      <div style="height:4px"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileBrowser',
  data() {
    return {
      currentPath: '', // relative path from home root
      parent: null,
      items: null,
      fileContent: '',
      fileTitle: '',
      showHidden: false,
      menuOpenFor: null,
      menuItem: null,
      menuPos: { top: 0, left: 0 },
      infoOpen: false,
      infoLoading: false,
      infoData: null
    };
  },
  computed: {
    displayedItems() {
      if (!this.items) return [];
      if (this.showHidden) return this.items;
      return this.items.filter(it => !it.name.startsWith('.'));
    },
    breadcrumbSegments() {
      if (!this.currentPath) return [];
      const parts = this.currentPath.split('/').filter(Boolean);
      const segs = [];
      let acc = '';
      for (const p of parts) {
        acc = acc ? acc + '/' + p : p;
        segs.push({ name: p, path: acc });
      }
      return segs;
    }
  },
  mounted() {
    try {
      const v = localStorage.getItem('showHiddenFiles');
      if (v !== null) this.showHidden = JSON.parse(v);
    } catch (_) { /* ignore */ }
    this.loadList('');
    // Close menus on global click/escape
    this._onWinClick = () => { this.menuOpenFor = null; this.menuItem = null; };
    this._onKey = (e) => { if (e.key === 'Escape') { this.menuOpenFor = null; this.menuItem = null; } };
    window.addEventListener('click', this._onWinClick);
    window.addEventListener('keydown', this._onKey);
  },
  beforeUnmount() {
    if (this._onWinClick) window.removeEventListener('click', this._onWinClick);
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
  },
  methods: {
    tokenHeader() {
      const token = localStorage.getItem('token');
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    },
    async loadList(relPath) {
      try {
        this.items = null;
        const resp = await fetch(`/api/fs/list?path=${encodeURIComponent(relPath || '')}`, {
          headers: { ...this.tokenHeader() }
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || '加载失败');
        }
        const data = await resp.json();
        // Normalize to relative path semantics (no leading slash)
        const pathVal = (data.path ?? '');
        const parentVal = (data.parent ?? null);
        this.currentPath = typeof pathVal === 'string' ? pathVal.replace(/^\/+/, '') : '';
        // parent === null means no parent; empty string '' means root
        this.parent = typeof parentVal === 'string' ? parentVal.replace(/^\/+/, '') : null;
        this.items = data.items || [];
        // If navigating, clear preview
        this.fileContent = '';
        this.fileTitle = '';
        this.menuOpenFor = null;
        this.menuItem = null;
      } catch (e) {
        alert(e.message || '加载失败');
      }
    },
    refresh() { this.loadList(this.currentPath); },
    goTo(relPath) { this.loadList(relPath || ''); },
    // Jump to user Home directory under root FS
    goToHome() { this.goTo('/home/xuekai'); },
    toggleHidden() {
      this.showHidden = !this.showHidden;
      try { localStorage.setItem('showHiddenFiles', JSON.stringify(this.showHidden)); } catch (_) {}
    },
    async getSignedUrl(it, opts = {}) {
      // Use a short-lived signed URL to allow native download without Authorization header
      try {
        const resp = await fetch(`/api/fs/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...this.tokenHeader() },
          body: JSON.stringify({ path: it.path, ttl: 300 }) // 5 min
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || '生成下载链接失败');
        }
        const data = await resp.json();
        let url = data.url;
        if (!url) throw new Error('下载链接无效');
        if (opts.bom) {
          url += (url.includes('?') ? '&' : '?') + 'bom=1';
        }
        return { url, expiresAt: data.expiresAt };
      } catch (e) {
        throw e;
      }
    },
    async download(it, bom = false) {
      try {
        const { url } = await this.getSignedUrl(it, { bom });
        const a = document.createElement('a');
        a.href = url;
        a.download = it.name || '';
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.menuOpenFor = null;
        this.menuItem = null;
      } catch (e) {
        alert(e.message || '下载失败');
      }
    },
    async copyLink(it, bom = false) {
      try {
        const { url, expiresAt } = await this.getSignedUrl(it, { bom });
        const fullUrl = new URL(url, window.location.origin).href;
        // Try modern clipboard API first
        let copied = false;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(fullUrl);
            copied = true;
          }
        } catch (_) {}
        if (!copied) {
          const ta = document.createElement('textarea');
          ta.value = fullUrl;
          ta.setAttribute('readonly', '');
          ta.style.position = 'absolute';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); copied = true; } catch (_) {}
          document.body.removeChild(ta);
        }
        if (copied) {
          const msg = expiresAt ? `直链已复制，有效期至：${new Date(expiresAt).toLocaleString()}` : '直链已复制';
          alert(msg);
        } else {
          alert(fullUrl); // 兜底：显示让用户手动复制
        }
        this.menuOpenFor = null;
        this.menuItem = null;
      } catch (e) {
        alert(e.message || '复制失败');
      }
    },
    toggleMenu(it, evt) {
      if (this.menuOpenFor === it.path) {
        this.menuOpenFor = null; this.menuItem = null; return;
      }
      const rect = (evt && evt.currentTarget) ? evt.currentTarget.getBoundingClientRect() : { left: 0, right: 0, bottom: 0 };
      const menuWidth = 220;
      const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
      const top = Math.min(rect.bottom + 6, window.innerHeight - 200);
      this.menuPos = { top, left };
      this.menuOpenFor = it.path;
      this.menuItem = it;
    },
    async showInfo(it) {
      this.menuOpenFor = null;
      this.menuItem = null;
      this.infoOpen = true;
      this.infoLoading = true;
      this.infoData = { name: it.name, path: it.path };
      try {
        const [stResp, mdResp] = await Promise.all([
          fetch(`/api/fs/stat?path=${encodeURIComponent(it.path)}`, { headers: { ...this.tokenHeader() } }),
          fetch(`/api/fs/hash?path=${encodeURIComponent(it.path)}&algo=md5`, { headers: { ...this.tokenHeader() } })
        ]);
        const st = stResp.ok ? await stResp.json() : {};
        const hd = mdResp.ok ? await mdResp.json() : {};
        this.infoData = {
          ...this.infoData,
          size: st.size,
          mtime: st.mtime,
          type: st.type,
          md5: hd.value || null
        };
      } catch (e) {
        // Best effort; keep modal open with partial info
      } finally {
        this.infoLoading = false;
      }
    },
    async copyMd5() {
      if (!this.infoData || !this.infoData.md5) return;
      const text = this.infoData.md5;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (_) {}
          document.body.removeChild(ta);
        }
        alert('MD5 已复制');
      } catch (_) {
        alert(text);
      }
    },
    async handleOpen(it) {
      if (it.type === 'dir') {
        this.goTo(it.path);
        return;
      }
      if (it.type === 'file') {
        try {
          const resp = await fetch(`/api/fs/read?path=${encodeURIComponent(it.path)}`, {
            headers: { ...this.tokenHeader() }
          });
          if (!resp.ok) {
            // try to interpret common cases
            if (resp.status === 415) {
              alert('该文件不是纯文本或编码不受支持，无法预览');
              return;
            }
            if (resp.status === 413) {
              alert('文件过大，无法预览');
              return;
            }
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `读取失败 (${resp.status})`);
          }
          const data = await resp.json();
          this.fileContent = data.content || '';
          this.fileTitle = data.name || it.name;
        } catch (e) {
          alert(e.message || '读取失败');
        }
      }
    },
    closePreview() { this.fileContent = ''; this.fileTitle = ''; },
    formatSize(s) {
      if (s == null || isNaN(s)) return '-';
      const units = ['B','KB','MB','GB','TB'];
      let i = 0; let n = Number(s);
      while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
      return (i === 0 ? n : n.toFixed(2)) + ' ' + units[i];
    },
    formatTime(t) {
      if (!t) return '-';
      try { return new Date(t).toLocaleString(); } catch (_) { return t; }
    }
  }
};
</script>

<style scoped>
.file-browser h3 { margin-bottom: 10px; }
.breadcrumbs { font-size: 0.95em; margin-bottom: 10px; }
.crumb { cursor: pointer; color: #007bff; }
.crumb.active { font-weight: 600; color: #333; cursor: default; }
.sep { margin: 0 4px; color: #999; }

.browser { display: flex; gap: 12px; }
.pane { background: #fff; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
.pane.left { flex: 1; padding: 8px; }
.pane.right { flex: 1; padding: 8px; display: flex; flex-direction: column; }

.toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
.list { max-height: 60vh; overflow: auto; border-top: 1px solid #eee; }
.row { display: flex; align-items: center; gap: 8px; padding: 8px 6px; border-bottom: 1px solid #f5f5f5; }
.row.clickable { cursor: pointer; }
.row:hover { background: #f7f7f7; }
.icon { width: 22px; text-align: center; }
.name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row { position: relative; }
.actions { margin-left: auto; display: flex; gap: 8px; position: relative; }
.link-btn { background: transparent; border: none; color: #007bff; cursor: pointer; padding: 2px 6px; }
.link-btn:hover { text-decoration: underline; }
.menu { position: absolute; right: 0; top: 28px; background: #fff; border: 1px solid #e6e6e6; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); padding: 6px 0; min-width: 170px; z-index: 10; }
.menu-float { position: fixed; background: #fff; border: 1px solid #e6e6e6; border-radius: 6px; box-shadow: 0 8px 20px rgba(0,0,0,0.18); padding: 6px 0; min-width: 220px; z-index: 2000; }
.menu-item { display: block; width: 100%; text-align: left; background: transparent; border: none; padding: 8px 12px; cursor: pointer; color: #333; }
.menu-item:hover { background: #f5f7fa; }
.empty { padding: 12px; color: #666; }

.viewer { display: flex; flex-direction: column; height: 100%; }
.viewer-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 1px solid #eee; }
.viewer-title { font-weight: 600; }
.content { margin: 8px 0 0; flex: 1; overflow: auto; background: #fafafa; border: 1px solid #eee; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; }
.placeholder { color: #666; padding: 12px; }

/* minimal modal */
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { background: #fff; min-width: 320px; max-width: 520px; border-radius: 8px; box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
.modal-header { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 600; }
.modal-body { padding: 12px; font-size: 0.95em; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 12px; border-top: 1px solid #eee; }
.kv { display: flex; margin: 4px 0; }
.kv .k { width: 88px; color: #666; }
.kv .v { flex: 1; word-break: break-all; }

@media (max-width: 900px) {
  .browser { flex-direction: column; }
}
</style>
