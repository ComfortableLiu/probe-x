/**
 * 配置管理器
 */

export class ConfigManager {
  constructor(options = {}) {
    this.config = {
      // 基础配置
      apiUrl: 'http://localhost:3000/data/beacon',
      appId: '',
      debug: false,
      
      // 自动埋点配置
      autoTrack: true,
      autoTrackPageView: true,
      autoTrackClick: true,
      autoTrackScroll: true,
      autoTrackForm: true,
      
      // 发送配置
      batchSize: 10,
      flushInterval: 5000, // 5秒
      maxRetries: 3,
      retryDelay: 1000, // 1秒
      
      // 存储配置
      storageType: 'localStorage', // localStorage, sessionStorage, memory
      maxStorageSize: 1000, // 最大存储事件数量
      
      // 过滤配置
      blacklistUrls: [],
      whitelistUrls: [],
      blacklistEvents: [],
      whitelistEvents: [],
      
      // 采样配置
      sampling: 1.0, // 采样率 0-1
      
      // 用户配置
      userProperties: {},
      globalProperties: {},
      
      // 其他配置
      enableHeartbeat: true,
      heartbeatInterval: 30000, // 30秒
      enableErrorTracking: true,
      enablePerformanceTracking: true,
      
      // 合并用户配置
      ...options,
    };
  }

  /**
   * 获取配置
   * @param {string} key - 配置键
   * @param {*} defaultValue - 默认值
   */
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * 设置配置
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   */
  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.config;
    
    for (const k of keys) {
      if (!target[k] || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }
    
    target[lastKey] = value;
  }

  /**
   * 获取所有配置
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   */
  update(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  /**
   * 重置配置
   */
  reset() {
    this.config = {};
  }

  /**
   * 验证配置
   */
  validate() {
    const errors = [];

    if (!this.config.apiUrl) {
      errors.push('apiUrl is required');
    }

    if (!this.config.appId) {
      errors.push('appId is required');
    }

    if (this.config.sampling < 0 || this.config.sampling > 1) {
      errors.push('sampling must be between 0 and 1');
    }

    if (this.config.batchSize < 1) {
      errors.push('batchSize must be greater than 0');
    }

    if (this.config.flushInterval < 1000) {
      errors.push('flushInterval must be at least 1000ms');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
