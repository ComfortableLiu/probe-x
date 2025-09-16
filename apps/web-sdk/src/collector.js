/**
 * 事件收集器
 */

import { v4 as uuidv4 } from 'uuid';

export class EventCollector {
  constructor(config) {
    this.config = config;
    this.storage = this.createStorage();
  }

  /**
   * 创建存储实例
   */
  createStorage() {
    const storageType = this.config.get('storageType', 'localStorage');
    const maxSize = this.config.get('maxStorageSize', 1000);

    switch (storageType) {
      case 'localStorage':
        return new LocalStorage(maxSize);
      case 'sessionStorage':
        return new SessionStorage(maxSize);
      case 'memory':
        return new MemoryStorage(maxSize);
      default:
        return new MemoryStorage(maxSize);
    }
  }

  /**
   * 收集事件
   * @param {string} eventName - 事件名称
   * @param {Object} properties - 事件属性
   * @param {Object} options - 选项
   */
  collectEvent(eventName, properties = {}, options = {}) {
    // 检查采样率
    if (!this.shouldSample()) {
      return null;
    }

    // 检查事件过滤
    if (!this.shouldTrackEvent(eventName)) {
      return null;
    }

    // 检查URL过滤
    if (!this.shouldTrackUrl()) {
      return null;
    }

    const event = {
      // 基础信息
      id: uuidv4(),
      eventName,
      timestamp: Date.now(),
      logTime: new Date().toISOString(),
      
      // 页面信息
      page: this.getPageInfo(),
      
      // 用户信息
      user: this.getUserInfo(),
      
      // 设备信息
      device: this.getDeviceInfo(),
      
      // 事件属性
      properties: {
        ...this.config.get('globalProperties', {}),
        ...properties,
      },
      
      // 选项
      options: {
        ...options,
      },
      
      // 会话信息
      session: this.getSessionInfo(),
      
      // 其他信息
      sdk: {
        name: 'probe-x-web-sdk',
        version: '1.0.0',
      },
    };

    // 存储事件
    this.storage.add(event);

    return event;
  }

  /**
   * 获取页面信息
   */
  getPageInfo() {
    return {
      title: document.title,
      url: window.location.href,
      path: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      referrer: document.referrer,
    };
  }

  /**
   * 获取用户信息
   */
  getUserInfo() {
    return {
      ...this.config.get('userProperties', {}),
    };
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }

  /**
   * 获取会话信息
   */
  getSessionInfo() {
    return {
      id: this.getSessionId(),
      startTime: this.getSessionStartTime(),
    };
  }

  /**
   * 获取会话ID
   */
  getSessionId() {
    const sessionKey = 'probe_x_session_id';
    return localStorage.getItem(sessionKey) || uuidv4();
  }

  /**
   * 获取会话开始时间
   */
  getSessionStartTime() {
    const sessionTimeKey = 'probe_x_session_time';
    return localStorage.getItem(sessionTimeKey) || Date.now().toString();
  }

  /**
   * 检查是否应该采样
   */
  shouldSample() {
    const sampling = this.config.get('sampling', 1.0);
    return Math.random() < sampling;
  }

  /**
   * 检查是否应该跟踪事件
   */
  shouldTrackEvent(eventName) {
    const blacklist = this.config.get('blacklistEvents', []);
    const whitelist = this.config.get('whitelistEvents', []);

    // 如果在黑名单中，不跟踪
    if (blacklist.includes(eventName)) {
      return false;
    }

    // 如果白名单不为空且不在白名单中，不跟踪
    if (whitelist.length > 0 && !whitelist.includes(eventName)) {
      return false;
    }

    return true;
  }

  /**
   * 检查是否应该跟踪URL
   */
  shouldTrackUrl() {
    const currentUrl = window.location.href;
    const blacklist = this.config.get('blacklistUrls', []);
    const whitelist = this.config.get('whitelistUrls', []);

    // 如果在黑名单中，不跟踪
    for (const pattern of blacklist) {
      if (this.matchUrl(currentUrl, pattern)) {
        return false;
      }
    }

    // 如果白名单不为空且不在白名单中，不跟踪
    if (whitelist.length > 0) {
      for (const pattern of whitelist) {
        if (this.matchUrl(currentUrl, pattern)) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * URL匹配
   */
  matchUrl(url, pattern) {
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return false;
  }

  /**
   * 获取所有事件
   */
  getAllEvents() {
    return this.storage.getAll();
  }

  /**
   * 清空事件
   */
  clearEvents() {
    this.storage.clear();
  }

  /**
   * 获取事件数量
   */
  getEventCount() {
    return this.storage.size();
  }
}

/**
 * 本地存储
 */
class LocalStorage {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.key = 'probe_x_events';
  }

  add(event) {
    const events = this.getAll();
    events.push(event);
    
    if (events.length > this.maxSize) {
      events.splice(0, events.length - this.maxSize);
    }
    
    try {
      localStorage.setItem(this.key, JSON.stringify(events));
    } catch (error) {
      console.error('LocalStorage error:', error);
    }
  }

  getAll() {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('LocalStorage error:', error);
      return [];
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error('LocalStorage error:', error);
    }
  }

  size() {
    return this.getAll().length;
  }
}

/**
 * 会话存储
 */
class SessionStorage {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.key = 'probe_x_events';
  }

  add(event) {
    const events = this.getAll();
    events.push(event);
    
    if (events.length > this.maxSize) {
      events.splice(0, events.length - this.maxSize);
    }
    
    try {
      sessionStorage.setItem(this.key, JSON.stringify(events));
    } catch (error) {
      console.error('SessionStorage error:', error);
    }
  }

  getAll() {
    try {
      const data = sessionStorage.getItem(this.key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('SessionStorage error:', error);
      return [];
    }
  }

  clear() {
    try {
      sessionStorage.removeItem(this.key);
    } catch (error) {
      console.error('SessionStorage error:', error);
    }
  }

  size() {
    return this.getAll().length;
  }
}

/**
 * 内存存储
 */
class MemoryStorage {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.events = [];
  }

  add(event) {
    this.events.push(event);
    
    if (this.events.length > this.maxSize) {
      this.events.splice(0, this.events.length - this.maxSize);
    }
  }

  getAll() {
    return [...this.events];
  }

  clear() {
    this.events = [];
  }

  size() {
    return this.events.length;
  }
}
