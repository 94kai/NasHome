<template>
  <div class="link-dashboard">
    <h3>链接</h3>
    <div class="link-grid-container">
      <a v-for="link in links" :key="link.name" :href="link.url" target="_blank" class="link-card">
        <div class="link-icon">
          <!-- If icon is an SVG string, render it directly -->
          <div v-if="isSvg(link.icon)" v-html="link.icon"></div>
          <!-- Otherwise, treat it as an image URL/path -->
          <img v-else :src="getImageUrl(link.icon)" :alt="link.name + ' icon'" />
        </div>
        <div class="link-name">{{ link.name }}</div>
      </a>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LinkDashboard',
  data() {
    return {
      links: [
        {
          name: '飞牛首页',
          url: 'https://nas.xuekai.top:8888',
          icon: new URL('../assets/images/feiniu.ico', import.meta.url).href
		},
        {
          name: 'Jellyfin',
          url: 'https://jellyfin.xuekai.top:8888',
          icon: new URL('../assets/images/jellyfin.png', import.meta.url).href
        },
        {
          name: 'blog',
          url: 'https://blog.xuekai.top:8888',
          icon: new URL('../assets/images/blog.png', import.meta.url).href
        },
        {
          name: 'blog控制台',
          url: 'https://blog.xuekai.top:8888/console',
          icon: new URL('../assets/images/blog.png', import.meta.url).href
        },
        {
          name: 'clash',
          url: 'https://clash.xuekai.top:8888/ui',
          icon: new URL('../assets/images/clash.png', import.meta.url).href
        },
        {
          name: 'Melody',
          url: 'https://melody.xuekai.top:8888',
          icon: new URL('../assets/images/melody.png', import.meta.url).href
        },
        {
          name: 'pdf',
          url: 'https://pdf.xuekai.top:8888',
          icon: new URL('../assets/images/stirling-pdf.png', import.meta.url).href
        },
        {
          name: 'music-tag',
          url: 'https://musictag.xuekai.top:8888',
          icon: new URL('../assets/images/musictag.png', import.meta.url).href
        },
        {
          name: '证件照',
          url: 'https://idphotos.xuekai.top:8888',
          icon: new URL('../assets/images/hivision_logo.png', import.meta.url).href
        },
        {
          name: 'Lucky',
          url: 'https://lucky.xuekai.top:8888',
          icon: new URL('../assets/images/lucky.svg', import.meta.url).href
        },
        {
          name: '迅雷',
          url: 'https://xunlei.xuekai.top:8888',
          icon: new URL('../assets/images/xunlei.png', import.meta.url).href
        },
      ]
    };
  },
  methods: {
    isSvg(icon) {
      return icon.trim().startsWith('<svg');
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

.link-grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 25px;
}

.link-card {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  text-decoration: none;
  color: #333;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.link-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
}

.link-icon {
  margin-bottom: 15px;
  color: #007bff;
  height: 48px; /* Set a fixed height for the container */
  display: flex;
  justify-content: center;
  align-items: center;
}

.link-icon svg,
.link-icon img {
  width: 48px;
  height: 48px;
}

.link-name {
  font-weight: 500;
  font-size: 1.1em;
}
/* --- Mobile Styles --- */
@media (max-width: 480px) {
	.link-grid-container {
	  display: grid;
	  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
	  gap: 25px;
	}
}
</style>
