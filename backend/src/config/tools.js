/**
 * 工具配置文件
 * 在这里定义所有工具，新增或删除工具只需修改此文件
 */

const toolRegistry = require('../services/toolRegistry');

// 工具配置数据
const toolsConfig = [
  // 文件管理类工具
  {
    id: 'file-manager',
    name: '文件管理',
    description: '浏览和管理NAS文件系统',
    url: '/file-manager',
    icon: '📁',
    category: 'file',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['文件', '管理', '浏览']
    }
  },
  {
    id: 'file-sync',
    name: '文件同步',
    description: '多设备文件同步工具',
    url: '/file-sync',
    icon: '🔄',
    category: 'file',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['同步', '文件', '多设备']
    }
  },

  // 下载类工具
  {
    id: 'download-center',
    name: '下载中心',
    description: '管理下载任务和进度',
    url: '/downloads',
    icon: '⬇️',
    category: 'download',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['下载', '任务', '进度']
    }
  },
  {
    id: 'bt-downloader',
    name: 'BT下载器',
    description: 'BitTorrent种子下载工具',
    url: '/bt-downloader',
    icon: '🌱',
    category: 'download',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['BT', '种子', '下载']
    }
  },

  // 系统管理类工具
  {
    id: 'system-monitor',
    name: '系统监控',
    description: '查看系统状态和性能指标',
    url: '/monitor',
    icon: '📊',
    category: 'system',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['监控', '系统', '性能']
    }
  },
  {
    id: 'settings',
    name: '设置中心',
    description: '系统配置和管理',
    url: '/settings',
    icon: '⚙️',
    category: 'system',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['设置', '配置', '管理']
    }
  },
  {
    id: 'log-viewer',
    name: '日志查看器',
    description: '查看系统日志和错误信息',
    url: '/logs',
    icon: '📋',
    category: 'system',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['日志', '查看', '调试']
    }
  },

  // 媒体类工具
  {
    id: 'media-server',
    name: '媒体服务器',
    description: '流媒体播放和管理',
    url: '/media-server',
    icon: '🎬',
    category: 'media',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['媒体', '流媒体', '播放']
    }
  },
  {
    id: 'photo-gallery',
    name: '相册管理',
    description: '照片和图片管理工具',
    url: '/photo-gallery',
    icon: '🖼️',
    category: 'media',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['相册', '照片', '图片']
    }
  },

  // 网络类工具
  {
    id: 'network-tools',
    name: '网络工具',
    description: '网络诊断和管理工具',
    url: '/network-tools',
    icon: '🌐',
    category: 'network',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['网络', '诊断', '管理']
    }
  },
  {
    id: 'vpn-manager',
    name: 'VPN管理',
    description: 'VPN连接和配置管理',
    url: '/vpn-manager',
    icon: '🔒',
    category: 'network',
    isActive: false, // 默认停用，需要时手动启用
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['VPN', '安全', '网络']
    }
  },

  // 开发工具类
  {
    id: 'code-editor',
    name: '代码编辑器',
    description: '在线代码编辑和开发环境',
    url: '/code-editor',
    icon: '💻',
    category: 'development',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['代码', '编辑', '开发']
    }
  },
  {
    id: 'database-manager',
    name: '数据库管理',
    description: '数据库可视化管理工具',
    url: '/database-manager',
    icon: '🗄️',
    category: 'development',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['数据库', '管理', '可视化']
    }
  },

  // 其他工具
  {
    id: 'backup-tool',
    name: '备份工具',
    description: '数据备份和恢复工具',
    url: '/backup-tool',
    icon: '💾',
    category: 'other',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['备份', '恢复', '数据']
    }
  },
  {
    id: 'task-scheduler',
    name: '任务调度器',
    description: '定时任务和自动化工具',
    url: '/task-scheduler',
    icon: '⏰',
    category: 'other',
    isActive: true,
    metadata: {
      version: '1.0.0',
      author: 'NAS Tools',
      tags: ['任务', '调度', '自动化']
    }
  }
];

/**
 * 初始化工具注册
 * 在应用启动时调用此函数注册所有工具
 */
function initializeTools() {
  console.log('🔧 开始初始化工具注册...');
  
  try {
    toolRegistry.registerTools(toolsConfig);
    
    const stats = toolRegistry.getStats();
    console.log(`✅ 工具注册完成! 总计: ${stats.total} 个工具, 激活: ${stats.active} 个, 分类: ${stats.categories} 个`);
    
    // 打印各分类的工具数量
    const categories = toolRegistry.getCategories();
    categories.forEach(category => {
      const tools = toolRegistry.getToolsByCategory(category);
      console.log(`  📂 ${category}: ${tools.length} 个工具`);
    });
    
  } catch (error) {
    console.error('❌ 工具注册失败:', error);
  }
}

/**
 * 获取工具注册实例
 * 供其他模块使用
 */
function getToolRegistry() {
  return toolRegistry;
}

module.exports = {
  initializeTools,
  getToolRegistry,
  toolsConfig
};
