<template>
  <div class="link-dashboard">
    <h3>链接</h3>
    <!-- Category blocks -->
    <div v-for="cat in categories" :key="cat.name" class="category-section">
      <div class="category-title">{{ cat.name }}</div>
      <div class="link-grid-container">
        <a v-for="link in cat.links" :key="link.name" :href="link.url" target="_blank" class="link-card">
          <div class="link-icon">
            <div v-if="isSvg(link.icon)" v-html="link.icon"></div>
            <img v-else :src="getImageUrl(link.icon)" :alt="link.name + ' icon'" />
          </div>
          <div class="link-name">{{ link.name }}</div>
        </a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LinkDashboard',
  data() {
    return {
      // Group links by category
      categories: [
        {
          name: '常用',
          links: [
            { name: '飞牛首页', url: 'https://nas.xuekai.top:8888', icon: new URL('../assets/images/feiniu.ico', import.meta.url).href },
            { name: '飞牛论坛', url: 'https://club.fnnas.com/portal.php', icon: new URL('../assets/images/feiniu.ico', import.meta.url).href },
          ]
        },
        {
          name: '媒体',
          links: [
            { name: 'Jellyfin', url: 'https://jellyfin.xuekai.top:8888', icon: new URL('../assets/images/jellyfin.png', import.meta.url).href },
            { name: '迅雷', url: 'https://xunlei.xuekai.top:8888', icon: new URL('../assets/images/xunlei.png', import.meta.url).href },
          ]
        },
        {
          name: '博客/网站',
          links: [
            { name: 'blog', url: 'https://blog.xuekai.top:8888', icon: new URL('../assets/images/blog.png', import.meta.url).href },
            { name: 'blog控制台', url: 'https://blog.xuekai.top:8888/console', icon: new URL('../assets/images/blog.png', import.meta.url).href },
          ]
        },
        {
          name: '工具',
          links: [
            { name: 'Home Assistant', url: 'https://ha.xuekai.top:8888', icon: new URL('../assets/images/home-assistant.png', import.meta.url).href },
            { name: 'clash', url: 'https://clash.xuekai.top:8888/ui', icon: new URL('../assets/images/clash.png', import.meta.url).href },
            { name: 'Melody', url: 'https://melody.xuekai.top:8888', icon: new URL('../assets/images/melody.png', import.meta.url).href },
            { name: 'pdf', url: 'https://pdf.xuekai.top:8888', icon: new URL('../assets/images/stirling-pdf.png', import.meta.url).href },
            { name: 'music-tag', url: 'https://musictag.xuekai.top:8888', icon: new URL('../assets/images/musictag.png', import.meta.url).href },
            { name: '证件照', url: 'https://idphotos.xuekai.top:8888', icon: new URL('../assets/images/hivision_logo.png', import.meta.url).href },
            { name: 'Lucky', url: 'https://lucky.xuekai.top:8888', icon: new URL('../assets/images/lucky.svg', import.meta.url).href },
            { name: 'Material Icons', url: 'https://fonts.google.com/icons', icon: new URL('../assets/images/material-icons.svg', import.meta.url).href },
          ]
        },
      ]
    };
  },
  methods: {
    isSvg(icon) {
      return typeof icon === 'string' && icon.trim().startsWith('<svg');
    },
    getImageUrl(path) {
      if (path.startsWith('http') || path.startsWith('/')) {
        // If it's a full URL or an absolute path, use it directly
        return path;
      }
      // For relative paths in assets, Vite needs this special URL constructor
      return new URL(path, import.meta.url).href;
    }
  }
};
</script>

<style scoped>
.link-dashboard h3 {
  font-size: 2em;
  color: #333;
  margin-bottom: 30px;
}

.category-section {
  margin-bottom: 22px;
}

.category-title {
  font-size: 1.1em;
  color: #555;
  margin: 4px 0 10px;
  font-weight: 600;
}

.link-grid-container {
  /* Responsive multi-column grid of compact rows */
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.link-card {
  /* Single-line, compact row */
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  text-decoration: none;
  color: #333;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: background-color 0.15s ease-in-out;
}

.link-card:hover {
  background-color: #f7f7f7;
}

.link-icon {
  /* Inline icon at left */
  margin-right: 10px;
  color: #007bff;
  display: flex;
  justify-content: center;
  align-items: center;
}

.link-icon svg,
.link-icon img {
  width: 20px;
  height: 20px;
}

.link-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.95em;
  line-height: 1; /* keep one-line height */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* one-line text */
}
/* --- Mobile Styles --- */
@media (max-width: 1024px) {
  .link-grid-container {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}

@media (max-width: 640px) {
  .link-grid-container {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
  .link-card {
    padding: 8px 10px;
  }
}
</style>
