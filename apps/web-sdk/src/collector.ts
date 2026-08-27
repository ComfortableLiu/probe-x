/**
 * 事件收集器
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  ProbeXEvent, 
  PageInfo, 
  UserInfo, 
  DeviceInfo, 
  SessionInfo, 
  SDKInfo,
  TrackOptions,
  Storage
} from './types';
import { ConfigManager } from './config';

export class EventCollector {
  private config: ConfigManager;
  private storage: Storage;

  constructor(config: ConfigManager) {
    this.config = config;
    this.storage = this.createStorage();
  }

  /**
   * 创建存储实例
   */
  private createStorage(): Storage {
    const storageType = this.config.get('storageType', 'localStorage') as 'localStorage' | 'sessionStorage' | 'memory';
    const maxSize = this.config.get('maxStorageSize', 1000);

    switch (storageType) {
      case 'localStorage':
        return new LocalStorage(maxSize, this.config);
      case 'sessionStorage':
        return new SessionStorage(maxSize, this.config);
      case 'memory':
        return new MemoryStorage(maxSize);
      default:
        return new MemoryStorage(maxSize);
    }
  }

  /**
   * 收集事件
   */
  collectEvent(eventName: string, properties: Record<string, any> = {}, options: TrackOptions = {}): ProbeXEvent | null {
    // 检查DNT设置
    if (this.config.shouldRespectDNT()) {
      return null;
    }

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

    const now = Date.now();
    const event: ProbeXEvent = {
      // 基础信息
      id: uuidv4(),
      eventName,
      timestamp: now,
      logTime: new Date(now).toISOString(),
      
      // 页面信息
      page: this.getPageInfo(),
      
      // 用户信息
      user: this.getUserInfo(),
      
      // 设备信息
      device: this.getDeviceInfo(),
      
      // 事件属性
      properties: {
        ...this.config.get('globalProperties', {}),
        ...this.maskSensitiveData(properties),
      },
      
      // 选项
      options: {
        ...options,
      },
      
      // 会话信息
      session: this.getSessionInfo(),
      
      // SDK信息
      sdk: this.getSDKInfo(),
    };

    // 添加性能数据
    if (this.config.isFeatureEnabled('performance')) {
      event.performance = this.getPerformanceData();
    }

    // 存储事件
    this.storage.add(event);

    return event;
  }

  /**
   * 获取页面信息
   */
  private getPageInfo(): PageInfo {
    return {
      title: document.title,
      url: window.location.href,
      path: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      referrer: document.referrer,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scroll: {
        x: window.pageXOffset || document.documentElement.scrollLeft,
        y: window.pageYOffset || document.documentElement.scrollTop,
        percentage: this.getScrollPercentage(),
      },
    };
  }

  /**
   * 获取用户信息
   */
  private getUserInfo(): UserInfo {
    return {
      ...this.config.get('userProperties', {}),
    };
  }

  /**
   * 获取设备信息
   */
  private getDeviceInfo(): DeviceInfo {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const battery = (navigator as any).battery || (navigator as any).getBattery?.();

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: Array.from(navigator.languages || [navigator.language]),
      platform: navigator.platform,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        orientation: (screen as any).orientation?.type,
        pixelRatio: window.devicePixelRatio || 1,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      connection: connection ? {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      } : undefined,
      battery: battery ? {
        charging: battery.charging,
        level: battery.level,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      } : undefined,
    };
  }

  /**
   * 获取会话信息
   */
  private getSessionInfo(): SessionInfo {
    const sessionId = this.getSessionId();
    const sessionStartTime = this.getSessionStartTime();
    const now = Date.now();
    
    return {
      id: sessionId,
      startTime: new Date(parseInt(sessionStartTime)).toISOString(),
      duration: now - parseInt(sessionStartTime),
      pageViews: this.getSessionPageViews(),
      events: this.getSessionEventCount(),
    };
  }

  /**
   * 获取SDK信息
   */
  private getSDKInfo(): SDKInfo {
    return {
      name: 'probe-x-web-sdk',
      version: '2.0.0',
      build: process.env.BUILD_VERSION || 'dev',
    };
  }

  /**
   * 获取性能数据
   */
  private getPerformanceData(): any {
    if (!window.performance) {
      return null;
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const memory = (performance as any).memory;

    return {
      navigation: navigation ? {
        navigationStart: navigation.fetchStart || 0,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        loadComplete: navigation.loadEventEnd - navigation.fetchStart,
        firstByte: navigation.responseStart - navigation.fetchStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        domComplete: navigation.domComplete - navigation.fetchStart,
      } : null,
      paint: paint.map(p => ({
        name: p.name,
        startTime: p.startTime,
      })),
      memory: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : null,
    };
  }

  /**
   * 获取会话ID
   */
  private getSessionId(): string {
    const sessionKey = this.config.getStorageKey('session_id');
    
    try {
      return localStorage.getItem(sessionKey) || uuidv4();
    } catch {
      // localStorage 不可用（隐私模式/SSR），回退到内存
      return uuidv4();
    }
  }

  /**
   * 获取会话开始时间
   */
  private getSessionStartTime(): string {
    // 与 SessionManager 写入的 key 保持一致（session_start_time 为会话开始时间，session_time 是最后活动时间）
    const sessionStartKey = this.config.getStorageKey('session_start_time');
    
    try {
      return localStorage.getItem(sessionStartKey) || Date.now().toString();
    } catch {
      // localStorage 不可用
      return Date.now().toString();
    }
  }

  /**
   * 获取会话页面访问数
   */
  private getSessionPageViews(): number {
    const key = this.config.getStorageKey('session_page_views');
    
    try {
      const count = parseInt(localStorage.getItem(key) || '0');
      return count;
    } catch {
      // localStorage 不可用
      return 0;
    }
  }

  /**
   * 获取会话事件数
   */
  private getSessionEventCount(): number {
    // 与 SessionManager 写入的 key 保持一致（session_events）
    const key = this.config.getStorageKey('session_events');
    
    try {
      const count = parseInt(localStorage.getItem(key) || '0');
      return count + 1; // 包含当前事件
    } catch {
      // localStorage 不可用
      return 1; // 仅包含当前事件
    }
  }

  /**
   * 获取滚动百分比
   */
  private getScrollPercentage(): number {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    if (documentHeight === 0) return 0;
    
    return Math.round((scrollTop / documentHeight) * 100);
  }

  /**
   * 检查是否应该采样
   */
  private shouldSample(): boolean {
    const sampling = this.config.get('sampling', 1.0);
    return Math.random() < sampling;
  }

  /**
   * 检查是否应该跟踪事件
   */
  private shouldTrackEvent(eventName: string): boolean {
    const blacklist = this.config.get('blacklistEvents', []) as string[];
    const whitelist = this.config.get('whitelistEvents', []) as string[];

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
  private shouldTrackUrl(): boolean {
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
  private matchUrl(url: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return false;
  }

  /**
   * 脱敏敏感数据
   */
  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    if (!this.config.get('maskSensitiveData', true)) {
      return data;
    }

    const sensitiveKeys = ['password', 'pwd', 'token', 'secret', 'key', 'auth', 'credit', 'card', 'ssn', 'phone', 'email'];
    const masked = { ...data };

    Object.keys(masked).forEach(key => {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        if (typeof masked[key] === 'string') {
          masked[key] = '***';
        }
      }
    });

    return masked;
  }

  /**
   * 获取所有事件
   */
  getAllEvents(): ProbeXEvent[] {
    return this.storage.getAll();
  }

  /**
   * 清空事件
   */
  clearEvents(): void {
    this.storage.clear();
  }

  /**
   * 获取事件数量
   */
  getEventCount(): number {
    return this.storage.size();
  }
}

/**
 * 本地存储
 */
class LocalStorage implements Storage {
  private maxSize: number;
  private key: string;

  constructor(maxSize: number, config: ConfigManager) {
    this.maxSize = maxSize;
    this.key = config.getStorageKey('events');
  }

  add(event: ProbeXEvent): void {
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

  get(key: string): any {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('LocalStorage error:', error);
      return null;
    }
  }

  getAll(): ProbeXEvent[] {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('LocalStorage error:', error);
      return [];
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('LocalStorage error:', error);
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error('LocalStorage error:', error);
    }
  }

  size(): number {
    return this.getAll().length;
  }
}

/**
 * 会话存储
 */
class SessionStorage implements Storage {
  private maxSize: number;
  private key: string;

  constructor(maxSize: number, config: ConfigManager) {
    this.maxSize = maxSize;
    this.key = config.getStorageKey('events');
  }

  add(event: ProbeXEvent): void {
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

  get(key: string): any {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('SessionStorage error:', error);
      return null;
    }
  }

  getAll(): ProbeXEvent[] {
    try {
      const data = sessionStorage.getItem(this.key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('SessionStorage error:', error);
      return [];
    }
  }

  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error('SessionStorage error:', error);
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(this.key);
    } catch (error) {
      console.error('SessionStorage error:', error);
    }
  }

  size(): number {
    return this.getAll().length;
  }
}

/**
 * 内存存储
 */
class MemoryStorage implements Storage {
  private maxSize: number;
  private events: ProbeXEvent[] = [];
  private data: Map<string, any> = new Map();

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  add(event: ProbeXEvent): void {
    this.events.push(event);
    
    if (this.events.length > this.maxSize) {
      this.events.splice(0, this.events.length - this.maxSize);
    }
  }

  get(key: string): any {
    return this.data.get(key);
  }

  getAll(): ProbeXEvent[] {
    return [...this.events];
  }

  remove(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.events = [];
    this.data.clear();
  }

  size(): number {
    return this.events.length;
  }
}
