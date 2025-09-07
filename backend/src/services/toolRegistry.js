/**
 * 工具注册系统
 * 通过代码注册工具，避免数据库操作
 */

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.categories = new Set();
  }

  /**
   * 注册工具
   * @param {Object} toolConfig - 工具配置
   * @param {string} toolConfig.id - 工具唯一标识
   * @param {string} toolConfig.name - 工具名称
   * @param {string} toolConfig.description - 工具描述
   * @param {string} toolConfig.url - 工具链接
   * @param {string} toolConfig.icon - 工具图标
   * @param {string} toolConfig.category - 工具分类
   * @param {boolean} toolConfig.isActive - 是否激活
   * @param {Object} toolConfig.metadata - 额外元数据
   */
  registerTool(toolConfig) {
    const {
      id,
      name,
      description = '',
      url = '',
      icon = '🔧',
      category = 'other',
      isActive = true,
      metadata = {}
    } = toolConfig;

    if (!id || !name) {
      throw new Error('工具ID和名称不能为空');
    }

    if (this.tools.has(id)) {
      console.warn(`工具 ${id} 已存在，将被覆盖`);
    }

    const tool = {
      id,
      name,
      description,
      url,
      icon,
      category,
      isActive,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tools.set(id, tool);
    this.categories.add(category);

    console.log(`✅ 工具注册成功: ${name} (${id})`);
    return tool;
  }

  /**
   * 批量注册工具
   * @param {Array} toolsConfig - 工具配置数组
   */
  registerTools(toolsConfig) {
    toolsConfig.forEach(toolConfig => {
      try {
        this.registerTool(toolConfig);
      } catch (error) {
        console.error(`注册工具失败: ${toolConfig.id || 'unknown'}`, error.message);
      }
    });
  }

  /**
   * 获取所有工具
   * @param {boolean} activeOnly - 是否只返回激活的工具
   * @returns {Array} 工具列表
   */
  getAllTools(activeOnly = true) {
    const tools = Array.from(this.tools.values());
    
    if (activeOnly) {
      return tools.filter(tool => tool.isActive);
    }
    
    return tools;
  }

  /**
   * 根据分类获取工具
   * @param {string} category - 分类名称
   * @param {boolean} activeOnly - 是否只返回激活的工具
   * @returns {Array} 工具列表
   */
  getToolsByCategory(category, activeOnly = true) {
    const tools = Array.from(this.tools.values());
    let filteredTools = tools.filter(tool => tool.category === category);
    
    if (activeOnly) {
      filteredTools = filteredTools.filter(tool => tool.isActive);
    }
    
    return filteredTools;
  }

  /**
   * 根据ID获取工具
   * @param {string} id - 工具ID
   * @returns {Object|null} 工具对象
   */
  getToolById(id) {
    return this.tools.get(id) || null;
  }

  /**
   * 获取所有分类
   * @returns {Array} 分类列表
   */
  getCategories() {
    return Array.from(this.categories).sort();
  }

  /**
   * 更新工具
   * @param {string} id - 工具ID
   * @param {Object} updates - 更新内容
   * @returns {Object|null} 更新后的工具对象
   */
  updateTool(id, updates) {
    const tool = this.tools.get(id);
    if (!tool) {
      return null;
    }

    const updatedTool = {
      ...tool,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.tools.set(id, updatedTool);
    
    // 如果分类发生变化，更新分类集合
    if (updates.category && updates.category !== tool.category) {
      this.categories.add(updates.category);
    }

    console.log(`✅ 工具更新成功: ${updatedTool.name} (${id})`);
    return updatedTool;
  }

  /**
   * 删除工具
   * @param {string} id - 工具ID
   * @returns {boolean} 是否删除成功
   */
  removeTool(id) {
    const tool = this.tools.get(id);
    if (!tool) {
      return false;
    }

    this.tools.delete(id);
    console.log(`✅ 工具删除成功: ${tool.name} (${id})`);
    return true;
  }

  /**
   * 激活/停用工具
   * @param {string} id - 工具ID
   * @param {boolean} isActive - 是否激活
   * @returns {Object|null} 更新后的工具对象
   */
  toggleTool(id, isActive) {
    return this.updateTool(id, { isActive });
  }

  /**
   * 获取工具统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const allTools = Array.from(this.tools.values());
    const activeTools = allTools.filter(tool => tool.isActive);
    
    return {
      total: allTools.length,
      active: activeTools.length,
      inactive: allTools.length - activeTools.length,
      categories: this.categories.size
    };
  }
}

// 创建全局工具注册实例
const toolRegistry = new ToolRegistry();

module.exports = toolRegistry;
