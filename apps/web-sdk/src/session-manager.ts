/**
 * 会话管理器
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigManager } from './config';

export class SessionManager {
  private config: ConfigManager;
  private sessionId: string;
  private sessionStartTime: number;
  private lastActivityTime: number;
  private pageViews: number = 0;
  private events: number = 0;
  private sessionTimeout: number = 30 * 60 * 1000; // 30分钟
  private heartbeatTimer?: number;
  // 保存事件监听 handler 引用，destroy 时移除
  private activityEvents: string[] = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'];
  private activityHandler = () => this.updateLastActivity();
  private saveDataHandler = () => this.saveSessionData();
  private visibilityHandler = () => {
    if (document.hidden) {
      // 页面隐藏时保存数据
      this.saveSessionData();
    } else {
      // 页面显示时更新活动时间
      this.updateLastActivity();
    }
  };

  constructor(config: ConfigManager) {
    this.config = config;
    this.sessionTimeout = this.config.get('sessionTimeout', 30 * 60 * 1000);
    this.sessionId = this.getOrCreateSessionId();
    this.sessionStartTime = this.getSessionStartTime();
    this.lastActivityTime = Date.now();
    
    this.loadSessionData();
  }

  /**
   * 初始化会话管理器
   */
  init(): void {
    // 监听用户活动
    this.setupActivityListeners();
    
    // 启动心跳检测
    this.startHeartbeat();
    
    // 页面卸载时保存会话数据
    this.setupBeforeUnload();
    
    // 页面可见性变化时处理会话
    this.setupVisibilityChange();
  }

  /**
   * 获取或创建会话ID
   */
  private getOrCreateSessionId(): string {
    const sessionKey = this.config.getStorageKey('session_id');
    const sessionTimeKey = this.config.getStorageKey('session_time');

    try {
      let sessionId = localStorage.getItem(sessionKey);
      let sessionTime = localStorage.getItem(sessionTimeKey);

      const now = Date.now();

      // 检查会话是否过期
      if (!sessionId || !sessionTime || (now - parseInt(sessionTime)) > this.sessionTimeout) {
        sessionId = uuidv4();
        localStorage.setItem(sessionKey, sessionId);
        localStorage.setItem(sessionTimeKey, now.toString());

        // 重置会话数据
        this.resetSessionData();
      } else {
        // 更新最后活动时间
        localStorage.setItem(sessionTimeKey, now.toString());
      }

      return sessionId;
    } catch {
      // localStorage 不可用（隐私模式/SSR），回退到内存
      return uuidv4();
    }
  }

  /**
   * 获取会话开始时间
   */
  private getSessionStartTime(): number {
    try {
      const sessionStartKey = this.config.getStorageKey('session_start_time');
      let startTime = localStorage.getItem(sessionStartKey);

      if (!startTime) {
        const now = Date.now();
        localStorage.setItem(sessionStartKey, now.toString());
        return now;
      }

      return parseInt(startTime);
    } catch {
      return Date.now();
    }
  }

  /**
   * 加载会话数据
   */
  private loadSessionData(): void {
    try {
      const pageViewsKey = this.config.getStorageKey('session_page_views');
      const eventsKey = this.config.getStorageKey('session_events');

      this.pageViews = parseInt(localStorage.getItem(pageViewsKey) || '0');
      this.events = parseInt(localStorage.getItem(eventsKey) || '0');
    } catch {
      // localStorage 不可用，使用默认值
    }
  }

  /**
   * 保存会话数据
   */
  private saveSessionData(): void {
    try {
      const pageViewsKey = this.config.getStorageKey('session_page_views');
      const eventsKey = this.config.getStorageKey('session_events');

      localStorage.setItem(pageViewsKey, this.pageViews.toString());
      localStorage.setItem(eventsKey, this.events.toString());
    } catch {
      // localStorage 不可用
    }
  }

  /**
   * 重置会话数据
   */
  private resetSessionData(): void {
    this.pageViews = 0;
    this.events = 0;
    this.sessionStartTime = Date.now();

    try {
      const sessionStartKey = this.config.getStorageKey('session_start_time');
      localStorage.setItem(sessionStartKey, this.sessionStartTime.toString());
      this.saveSessionData();
    } catch {
      // localStorage 不可用
    }
  }

  /**
   * 设置用户活动监听
   */
  private setupActivityListeners(): void {
    this.activityEvents.forEach(event => {
      document.addEventListener(event, this.activityHandler, { passive: true });
    });
  }

  /**
   * 更新最后活动时间
   */
  private updateLastActivity(): void {
    this.lastActivityTime = Date.now();

    try {
      const sessionTimeKey = this.config.getStorageKey('session_time');
      localStorage.setItem(sessionTimeKey, this.lastActivityTime.toString());
    } catch {
      // localStorage 不可用
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    const interval = this.config.get('heartbeatInterval', 60000);
    
    this.heartbeatTimer = window.setInterval(() => {
      const now = Date.now();
      
      // 检查会话是否过期
      if (now - this.lastActivityTime > this.sessionTimeout) {
        this.expireSession();
      }
    }, interval);
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 会话过期处理
   */
  private expireSession(): void {
    // 创建新会话
    this.sessionId = uuidv4();
    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();

    try {
      const sessionKey = this.config.getStorageKey('session_id');
      const sessionTimeKey = this.config.getStorageKey('session_time');
      const sessionStartKey = this.config.getStorageKey('session_start_time');

      localStorage.setItem(sessionKey, this.sessionId);
      localStorage.setItem(sessionTimeKey, this.lastActivityTime.toString());
      localStorage.setItem(sessionStartKey, this.sessionStartTime.toString());
    } catch {
      // localStorage 不可用
    }

    // 重置会话数据
    this.resetSessionData();

    // 触发会话过期事件
    window.dispatchEvent(new CustomEvent('probe-x-session-expired', {
      detail: { sessionId: this.sessionId }
    }));
  }

  /**
   * 设置页面卸载监听
   */
  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', this.saveDataHandler);
    window.addEventListener('pagehide', this.saveDataHandler);
  }

  /**
   * 设置页面可见性变化监听
   */
  private setupVisibilityChange(): void {
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * 记录页面访问
   */
  recordPageView(): void {
    this.pageViews++;
    this.updateLastActivity();
    this.saveSessionData();
  }

  /**
   * 记录事件
   */
  recordEvent(): void {
    this.events++;
    this.updateLastActivity();
    this.saveSessionData();
  }

  /**
   * 获取会话信息
   */
  getSession(): { id: string; startTime: number; duration: number; pageViews: number; events: number } {
    return {
      id: this.sessionId,
      startTime: this.sessionStartTime,
      duration: Date.now() - this.sessionStartTime,
      pageViews: this.pageViews,
      events: this.events,
    };
  }

  /**
   * 获取会话ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 获取会话开始时间
   */
  getStartTime(): number {
    return this.sessionStartTime;
  }

  /**
   * 获取会话持续时间
   */
  getDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * 获取页面访问数
   */
  getPageViews(): number {
    return this.pageViews;
  }

  /**
   * 获取事件数
   */
  getEvents(): number {
    return this.events;
  }

  /**
   * 获取最后活动时间
   */
  getLastActivityTime(): number {
    return this.lastActivityTime;
  }

  /**
   * 检查会话是否活跃
   */
  isActive(): boolean {
    return Date.now() - this.lastActivityTime < this.sessionTimeout;
  }

  /**
   * 手动刷新会话
   */
  refresh(): void {
    this.updateLastActivity();
  }

  /**
   * 手动结束会话
   */
  end(): void {
    // 保存最终数据
    this.saveSessionData();

    // 触发会话结束事件
    window.dispatchEvent(new CustomEvent('probe-x-session-ended', {
      detail: this.getSession()
    }));

    // 清理会话数据
    try {
      const keys = [
        'session_id',
        'session_time',
        'session_start_time',
        'session_page_views',
        'session_events'
      ];

      keys.forEach(key => {
        localStorage.removeItem(this.config.getStorageKey(key));
      });
    } catch {
      // localStorage 不可用
    }

    // 停止心跳
    this.stopHeartbeat();
  }

  /**
   * 获取会话统计信息
   */
  getStats(): {
    sessionId: string;
    startTime: number;
    duration: number;
    pageViews: number;
    events: number;
    lastActivity: number;
    isActive: boolean;
  } {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      duration: this.getDuration(),
      pageViews: this.pageViews,
      events: this.events,
      lastActivity: this.lastActivityTime,
      isActive: this.isActive(),
    };
  }

  /**
   * 设置会话属性
   */
  setProperty(key: string, value: any): void {
    const propertyKey = this.config.getStorageKey(`session_prop_${key}`);
    try {
      localStorage.setItem(propertyKey, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to set session property:', error);
    }
  }

  /**
   * 获取会话属性
   */
  getProperty(key: string): any {
    const propertyKey = this.config.getStorageKey(`session_prop_${key}`);
    try {
      const value = localStorage.getItem(propertyKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Failed to get session property:', error);
      return null;
    }
  }

  /**
   * 移除会话属性
   */
  removeProperty(key: string): void {
    const propertyKey = this.config.getStorageKey(`session_prop_${key}`);
    localStorage.removeItem(propertyKey);
  }

  /**
   * 获取所有会话属性
   */
  getAllProperties(): Record<string, any> {
    const prefix = this.config.getStorageKey('session_prop_');
    const properties: Record<string, any> = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const propertyKey = key.substring(prefix.length);
        try {
          const value = localStorage.getItem(key);
          properties[propertyKey] = value ? JSON.parse(value) : null;
        } catch (error) {
          console.warn('Failed to parse session property:', error);
        }
      }
    }
    
    return properties;
  }

  /**
   * 销毁会话管理器
   */
  destroy(): void {
    this.stopHeartbeat();
    this.saveSessionData();

    // 移除所有事件监听
    this.activityEvents.forEach(event => {
      document.removeEventListener(event, this.activityHandler);
    });
    window.removeEventListener('beforeunload', this.saveDataHandler);
    window.removeEventListener('pagehide', this.saveDataHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }
}
