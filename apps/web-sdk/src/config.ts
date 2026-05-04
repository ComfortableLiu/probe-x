/**
 * 配置管理器
 */

import type { ProbeXConfig, ValidationResult } from './types';

export class ConfigManager {
  private config: ProbeXConfig;

  constructor(options: ProbeXConfig = {}) {
    this.config = {
      // 基础配置
      apiUrl: 'http://localhost:3000/point/report',
      appId: '',
      debug: false,
      
      // 自动埋点配置
      autoTrack: true,
      autoTrackPageView: true,
      autoTrackClick: true,
      autoTrackScroll: true,
      autoTrackForm: true,
      autoTrackHashChange: true,
      autoTrackUnload: true,
      
      // 发送配置
      batchSize: 10,
      flushInterval: 5000, // 5秒
      maxRetries: 3,
      retryDelay: 1000, // 1秒
      sendTimeout: 10000, // 10秒
      
      // 存储配置
      storageType: 'localStorage',
      maxStorageSize: 1000,
      storagePrefix: 'probe_x_',
      
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
      
      // 功能开关
      enableHeartbeat: true,
      heartbeatInterval: 30000, // 30秒
      enableErrorTracking: true,
      enablePerformanceTracking: true,
      enableNetworkTracking: false,
      enableResourceTracking: false,
      enableHeatmap: false,
      enableSessionReplay: false,
      
      // 数据压缩
      enableCompression: false,
      compressionType: 'gzip',
      
      // 隐私配置
      respectDNT: true,
      anonymizeIP: false,
      maskSensitiveData: true,
      
      // 插件配置
      plugins: [],
      
      // 合并用户配置
      ...options,
    };
  }

  /**
   * 获取配置
   */
  get<T = any>(key: string, defaultValue?: T): T {
    const keys = key.split('.');
    let value: any = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue as T;
      }
    }
    
    return value as T;
  }

  /**
   * 设置配置
   */
  set(key: string, value: any): void {
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    const keys = key.split('.');
    const lastKey = keys.pop()!;
    let target: any = this.config;

    for (const k of keys) {
      if (DANGEROUS_KEYS.has(k)) {
        return;
      }
      if (!target[k] || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    if (DANGEROUS_KEYS.has(lastKey)) {
      return;
    }
    target[lastKey] = value;
  }

  /**
   * 获取所有配置
   */
  getAll(): ProbeXConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  update(newConfig: Partial<ProbeXConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  /**
   * 重置配置
   */
  reset(): void {
    this.config = {} as ProbeXConfig;
  }

  /**
   * 验证配置
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    if (!this.config.apiUrl) {
      errors.push('apiUrl is required');
    }

    if (!this.config.appId) {
      errors.push('appId is required');
    }

    if (this.config.sampling !== undefined && (this.config.sampling < 0 || this.config.sampling > 1)) {
      errors.push('sampling must be between 0 and 1');
    }

    if (this.config.batchSize !== undefined && this.config.batchSize < 1) {
      errors.push('batchSize must be greater than 0');
    }

    if (this.config.flushInterval !== undefined && this.config.flushInterval < 1000) {
      errors.push('flushInterval must be at least 1000ms');
    }

    if (this.config.maxRetries !== undefined && this.config.maxRetries < 0) {
      errors.push('maxRetries must be non-negative');
    }

    if (this.config.retryDelay !== undefined && this.config.retryDelay < 0) {
      errors.push('retryDelay must be non-negative');
    }

    if (this.config.sendTimeout !== undefined && this.config.sendTimeout < 1000) {
      errors.push('sendTimeout must be at least 1000ms');
    }

    if (this.config.maxStorageSize !== undefined && this.config.maxStorageSize < 1) {
      errors.push('maxStorageSize must be greater than 0');
    }

    if (this.config.heartbeatInterval !== undefined && this.config.heartbeatInterval < 1000) {
      errors.push('heartbeatInterval must be at least 1000ms');
    }

    // 验证URL格式
    if (this.config.apiUrl && !this.isValidUrl(this.config.apiUrl)) {
      errors.push('apiUrl must be a valid URL');
    }

    // 验证存储类型
    if (this.config.storageType && !['localStorage', 'sessionStorage', 'memory'].includes(this.config.storageType)) {
      errors.push('storageType must be one of: localStorage, sessionStorage, memory');
    }

    // 验证压缩类型
    if (this.config.compressionType && !['gzip', 'lz4'].includes(this.config.compressionType)) {
      errors.push('compressionType must be one of: gzip, lz4');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查是否为有效URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取环境信息
   */
  getEnvironmentInfo(): Record<string, any> {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * 检查功能是否启用
   */
  isFeatureEnabled(feature: string): boolean {
    const featureMap: Record<string, string> = {
      'autoTrack': 'autoTrack',
      'pageView': 'autoTrackPageView',
      'click': 'autoTrackClick',
      'scroll': 'autoTrackScroll',
      'form': 'autoTrackForm',
      'hashChange': 'autoTrackHashChange',
      'unload': 'autoTrackUnload',
      'error': 'enableErrorTracking',
      'performance': 'enablePerformanceTracking',
      'network': 'enableNetworkTracking',
      'resource': 'enableResourceTracking',
      'heatmap': 'enableHeatmap',
      'sessionReplay': 'enableSessionReplay',
      'heartbeat': 'enableHeartbeat',
    };

    const configKey = featureMap[feature];
    return configKey ? this.get(configKey, false) : false;
  }

  /**
   * 检查是否应该尊重DNT设置
   */
  shouldRespectDNT(): boolean {
    if (!this.get('respectDNT', true)) {
      return false;
    }

    // 检查Do Not Track设置
    const dnt = navigator.doNotTrack || (window as any).doNotTrack || (navigator as any).msDoNotTrack;
    return dnt === '1' || dnt === 'yes';
  }

  /**
   * 获取存储键名
   */
  getStorageKey(key: string): string {
    const prefix = this.get('storagePrefix', 'probe_x_');
    return `${prefix}${key}`;
  }
}
