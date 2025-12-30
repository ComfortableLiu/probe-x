/**
 * 工具类
 */

import type { BrowserInfo, OSInfo } from './types';

export class Utils {
  /**
   * 生成UUID
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 防抖函数
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number, 
    immediate: boolean = false
  ): (...args: Parameters<T>) => void {
    let timeout: number | undefined;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        timeout = undefined;
        if (!immediate) func(...args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = window.setTimeout(later, wait);
      if (callNow) func(...args);
    };
  }

  /**
   * 节流函数
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T, 
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 深拷贝对象
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as unknown as T;
    if (typeof obj === 'object') {
      const clonedObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
    return obj;
  }

  /**
   * 获取URL参数
   */
  static getUrlParameter(name: string, url: string = window.location.href): string | null {
    try {
      const urlParams = new URLSearchParams(new URL(url).search);
      return urlParams.get(name);
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取所有URL参数
   */
  static getAllUrlParameters(url: string = window.location.href): Record<string, string> {
    try {
      const urlParams = new URLSearchParams(new URL(url).search);
      const params: Record<string, string> = {};
      for (const [key, value] of urlParams.entries()) {
        params[key] = value;
      }
      return params;
    } catch (error) {
      return {};
    }
  }

  /**
   * 检查是否为移动设备
   */
  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * 检查是否为iOS设备
   */
  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  /**
   * 检查是否为Android设备
   */
  static isAndroid(): boolean {
    return /Android/.test(navigator.userAgent);
  }

  /**
   * 检查是否为平板设备
   */
  static isTablet(): boolean {
    return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
  }

  /**
   * 检查是否为桌面设备
   */
  static isDesktop(): boolean {
    return !this.isMobile() && !this.isTablet();
  }

  /**
   * 获取设备类型
   */
  static getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (this.isTablet()) return 'tablet';
    if (this.isMobile()) return 'mobile';
    return 'desktop';
  }

  /**
   * 获取浏览器信息
   */
  static getBrowserInfo(): BrowserInfo {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let engine = 'Unknown';
    let engineVersion = 'Unknown';

    // 检测浏览器
    if (ua.indexOf('Edg') > -1) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
      engine = 'Blink';
    } else if (ua.indexOf('Chrome') > -1) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
      engine = 'Blink';
    } else if (ua.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
      engine = 'Gecko';
    } else if (ua.indexOf('Safari') > -1) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
      engine = 'WebKit';
    } else if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) {
      browserName = 'IE';
      browserVersion = ua.match(/(?:MSIE |rv:)(\d+)/)?.[1] || 'Unknown';
      engine = 'Trident';
    } else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) {
      browserName = 'Opera';
      browserVersion = ua.match(/(?:Opera|OPR)\/(\d+)/)?.[1] || 'Unknown';
      engine = 'Blink';
    }

    // 检测引擎版本
    if (engine === 'Blink') {
      engineVersion = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
    } else if (engine === 'Gecko') {
      engineVersion = ua.match(/rv:(\d+)/)?.[1] || 'Unknown';
    } else if (engine === 'WebKit') {
      engineVersion = ua.match(/WebKit\/(\d+)/)?.[1] || 'Unknown';
    } else if (engine === 'Trident') {
      engineVersion = ua.match(/Trident\/(\d+)/)?.[1] || 'Unknown';
    }

    return {
      name: browserName,
      version: browserVersion,
      userAgent: ua,
      engine,
      engineVersion,
    };
  }

  /**
   * 获取操作系统信息
   */
  static getOSInfo(): OSInfo {
    const ua = navigator.userAgent;
    let osName = 'Unknown';
    let osVersion = 'Unknown';
    let architecture = 'Unknown';

    if (ua.indexOf('Windows NT') > -1) {
      osName = 'Windows';
      const version = ua.match(/Windows NT (\d+\.\d+)/)?.[1];
      if (version) {
        const versionMap: Record<string, string> = {
          '10.0': '10/11',
          '6.3': '8.1',
          '6.2': '8',
          '6.1': '7',
          '6.0': 'Vista',
          '5.1': 'XP',
        };
        osVersion = versionMap[version] || version;
      }
      architecture = ua.indexOf('WOW64') > -1 || ua.indexOf('Win64') > -1 ? 'x64' : 'x86';
    } else if (ua.indexOf('Mac OS X') > -1) {
      osName = 'macOS';
      osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || 'Unknown';
      architecture = ua.indexOf('Intel') > -1 ? 'Intel' : 'ARM';
    } else if (ua.indexOf('Linux') > -1) {
      osName = 'Linux';
      architecture = ua.indexOf('x86_64') > -1 ? 'x64' : 'x86';
    } else if (ua.indexOf('Android') > -1) {
      osName = 'Android';
      osVersion = ua.match(/Android (\d+\.\d+)/)?.[1] || 'Unknown';
      architecture = ua.indexOf('arm64') > -1 ? 'arm64' : 'arm';
    } else if (ua.indexOf('iPhone OS') > -1 || ua.indexOf('iPad') > -1) {
      osName = 'iOS';
      osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || 'Unknown';
      architecture = 'ARM';
    }

    return {
      name: osName,
      version: osVersion,
      architecture,
    };
  }

  /**
   * 格式化时间
   */
  static formatDate(date: Date | number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const milliseconds = String(d.getMilliseconds()).padStart(3, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('SSS', milliseconds);
  }

  /**
   * 获取时间戳
   */
  static getTimestamp(): number {
    return Date.now();
  }

  /**
   * 获取ISO时间字符串
   */
  static getISOString(): string {
    return new Date().toISOString();
  }

  /**
   * 检查对象是否为空
   */
  static isEmpty(obj: any): boolean {
    if (obj === null || obj === undefined) return true;
    if (typeof obj === 'string') return obj.length === 0;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }

  /**
   * 安全地获取对象属性
   */
  static safeGet(obj: any, path: string, defaultValue: any = undefined): any {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined || !(key in result)) {
        return defaultValue;
      }
      result = result[key];
    }
    
    return result;
  }

  /**
   * 安全地设置对象属性
   */
  static safeSet(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let target = obj;
    
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
  }

  /**
   * 生成随机字符串
   */
  static randomString(
    length: number = 8, 
    chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  ): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成随机数字
   */
  static randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 检查是否为有效的URL
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查是否为有效的邮箱
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 检查是否为有效的手机号（中国）
   */
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 检查是否为有效的身份证号（中国）
   */
  static isValidIdCard(idCard: string): boolean {
    const idCardRegex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
    return idCardRegex.test(idCard);
  }

  /**
   * 压缩字符串
   */
  static compress(str: string): string {
    // 简单的字符串压缩，移除多余空白字符
    return str.replace(/\s+/g, ' ').trim();
  }

  /**
   * 转义HTML字符
   */
  static escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 反转义HTML字符
   */
  static unescapeHtml(str: string): string {
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent || div.innerText || '';
  }

  /**
   * 转义正则表达式特殊字符
   */
  static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 将字符串转换为驼峰命名
   */
  static toCamelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
  }

  /**
   * 将驼峰命名转换为短横线命名
   */
  static toKebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * 将驼峰命名转换为下划线命名
   */
  static toSnakeCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  }

  /**
   * 截断字符串
   */
  static truncate(str: string, length: number, suffix: string = '...'): string {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  }

  /**
   * 计算字符串哈希值
   */
  static hash(str: string): number {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * 获取文件扩展名
   */
  static getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取网络连接类型
   */
  static getConnectionType(): string {
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
    
    if (connection) {
      return connection.effectiveType || connection.type || 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * 检查是否支持某个API
   */
  static isSupported(api: string): boolean {
    const supportMap: Record<string, () => boolean> = {
      'localStorage': () => typeof Storage !== 'undefined',
      'sessionStorage': () => typeof Storage !== 'undefined',
      'indexedDB': () => typeof indexedDB !== 'undefined',
      'webWorker': () => typeof Worker !== 'undefined',
      'serviceWorker': () => 'serviceWorker' in navigator,
      'pushManager': () => 'PushManager' in window,
      'notification': () => 'Notification' in window,
      'geolocation': () => 'geolocation' in navigator,
      'camera': () => 'mediaDevices' in navigator,
      'webRTC': () => 'RTCPeerConnection' in window,
      'webGL': () => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
          return false;
        }
      },
      'canvas': () => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext && canvas.getContext('2d'));
        } catch {
          return false;
        }
      },
      'touch': () => 'ontouchstart' in window,
      'orientation': () => 'orientation' in window,
      'battery': () => 'getBattery' in navigator,
      'vibration': () => 'vibrate' in navigator,
    };

    const checker = supportMap[api];
    return checker ? checker() : false;
  }

  /**
   * 获取浏览器特性支持情况
   */
  static getBrowserFeatures(): Record<string, boolean> {
    const features = [
      'localStorage', 'sessionStorage', 'indexedDB', 'webWorker', 
      'serviceWorker', 'pushManager', 'notification', 'geolocation',
      'camera', 'webRTC', 'webGL', 'canvas', 'touch', 'orientation',
      'battery', 'vibration'
    ];

    const result: Record<string, boolean> = {};
    features.forEach(feature => {
      result[feature] = this.isSupported(feature);
    });

    return result;
  }

  /**
   * 延迟执行
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试执行函数
   */
  static async retry<T>(
    fn: () => Promise<T>, 
    maxRetries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await this.delay(delay * Math.pow(2, i)); // 指数退避
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * 创建可取消的Promise
   */
  static createCancelablePromise<T>(
    promise: Promise<T>
  ): { promise: Promise<T>; cancel: () => void } {
    let isCanceled = false;
    
    const wrappedPromise = new Promise<T>((resolve, reject) => {
      promise.then(
        value => isCanceled ? reject(new Error('Canceled')) : resolve(value),
        error => isCanceled ? reject(new Error('Canceled')) : reject(error)
      );
    });
    
    return {
      promise: wrappedPromise,
      cancel: () => { isCanceled = true; }
    };
  }
}
