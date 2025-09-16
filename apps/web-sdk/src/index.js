/**
 * Probe-X Web SDK
 * 埋点数据收集SDK
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigManager } from './config';
import { EventCollector } from './collector';
import { DataSender } from './sender';
import { AutoTracker } from './auto-tracker';
import { Utils } from './utils';

class ProbeX {
  constructor(options = {}) {
    this.config = new ConfigManager(options);
    this.collector = new EventCollector(this.config);
    this.sender = new DataSender(this.config);
    this.autoTracker = new AutoTracker(this.config, this.collector);
    this.utils = new Utils();
    
    this.isInitialized = false;
    this.sessionId = this.generateSessionId();
    this.deviceId = this.getOrCreateDeviceId();
    
    this.init();
  }

  /**
   * 初始化SDK
   */
  init() {
    if (this.isInitialized) {
      console.warn('ProbeX SDK already initialized');
      return;
    }

    try {
      // 发送页面访问事件
      this.track('page_view', {
        page_title: document.title,
        page_url: window.location.href,
        page_path: window.location.pathname,
        referrer: document.referrer,
      });

      // 启动自动埋点
      if (this.config.get('autoTrack')) {
        this.autoTracker.start();
      }

      this.isInitialized = true;
      console.log('ProbeX SDK initialized successfully');
    } catch (error) {
      console.error('ProbeX SDK initialization failed:', error);
    }
  }

  /**
   * 手动埋点
   * @param {string} eventName - 事件名称
   * @param {Object} properties - 事件属性
   * @param {Object} options - 选项
   */
  track(eventName, properties = {}, options = {}) {
    if (!this.isInitialized) {
      console.warn('ProbeX SDK not initialized');
      return;
    }

    try {
      const event = this.collector.collectEvent(eventName, properties, options);
      this.sender.send(event);
    } catch (error) {
      console.error('ProbeX track error:', error);
    }
  }

  /**
   * 设置用户属性
   * @param {Object} userProperties - 用户属性
   */
  setUser(userProperties) {
    this.config.set('userProperties', {
      ...this.config.get('userProperties', {}),
      ...userProperties,
    });
  }

  /**
   * 设置全局属性
   * @param {Object} globalProperties - 全局属性
   */
  setGlobalProperties(globalProperties) {
    this.config.set('globalProperties', {
      ...this.config.get('globalProperties', {}),
      ...globalProperties,
    });
  }

  /**
   * 设置配置
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   */
  setConfig(key, value) {
    this.config.set(key, value);
  }

  /**
   * 获取配置
   * @param {string} key - 配置键
   * @param {*} defaultValue - 默认值
   */
  getConfig(key, defaultValue) {
    return this.config.get(key, defaultValue);
  }

  /**
   * 生成会话ID
   */
  generateSessionId() {
    const now = Date.now();
    const sessionKey = 'probe_x_session_id';
    const sessionExpiry = 30 * 60 * 1000; // 30分钟

    let sessionId = localStorage.getItem(sessionKey);
    let sessionTime = localStorage.getItem(sessionKey + '_time');

    if (!sessionId || !sessionTime || (now - parseInt(sessionTime)) > sessionExpiry) {
      sessionId = uuidv4();
      localStorage.setItem(sessionKey, sessionId);
      localStorage.setItem(sessionKey + '_time', now.toString());
    }

    return sessionId;
  }

  /**
   * 获取或创建设备ID
   */
  getOrCreateDeviceId() {
    const deviceKey = 'probe_x_device_id';
    let deviceId = localStorage.getItem(deviceKey);

    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem(deviceKey, deviceId);
    }

    return deviceId;
  }

  /**
   * 获取用户代理信息
   */
  getUserAgent() {
    return navigator.userAgent;
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
   * 获取屏幕信息
   */
  getScreenInfo() {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
    };
  }

  /**
   * 获取浏览器信息
   */
  getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    };
  }

  /**
   * 销毁SDK
   */
  destroy() {
    if (this.autoTracker) {
      this.autoTracker.stop();
    }
    this.isInitialized = false;
    console.log('ProbeX SDK destroyed');
  }
}

// 创建全局实例
if (typeof window !== 'undefined') {
  window.ProbeX = ProbeX;
}

export default ProbeX;
