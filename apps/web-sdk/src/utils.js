/**
 * 工具类
 */

export class Utils {
  /**
   * 生成UUID
   */
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 防抖函数
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 等待时间
   * @param {boolean} immediate - 是否立即执行
   */
  static debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func(...args);
    };
  }

  /**
   * 节流函数
   * @param {Function} func - 要节流的函数
   * @param {number} limit - 时间限制
   */
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 深拷贝对象
   * @param {*} obj - 要拷贝的对象
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  /**
   * 获取URL参数
   * @param {string} name - 参数名
   * @param {string} url - URL字符串
   */
  static getUrlParameter(name, url = window.location.href) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get(name);
  }

  /**
   * 获取所有URL参数
   * @param {string} url - URL字符串
   */
  static getAllUrlParameters(url = window.location.href) {
    const urlParams = new URLSearchParams(new URL(url).search);
    const params = {};
    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }
    return params;
  }

  /**
   * 检查是否为移动设备
   */
  static isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * 检查是否为iOS设备
   */
  static isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  /**
   * 检查是否为Android设备
   */
  static isAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  /**
   * 获取浏览器信息
   */
  static getBrowserInfo() {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    if (ua.indexOf('Chrome') > -1) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Safari') > -1) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Edge') > -1) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) {
      browserName = 'IE';
      browserVersion = ua.match(/(?:MSIE |rv:)(\d+)/)?.[1] || 'Unknown';
    }

    return {
      name: browserName,
      version: browserVersion,
      userAgent: ua,
    };
  }

  /**
   * 获取操作系统信息
   */
  static getOSInfo() {
    const ua = navigator.userAgent;
    let osName = 'Unknown';
    let osVersion = 'Unknown';

    if (ua.indexOf('Windows NT') > -1) {
      osName = 'Windows';
      const version = ua.match(/Windows NT (\d+\.\d+)/)?.[1];
      if (version) {
        const versionMap = {
          '10.0': '10',
          '6.3': '8.1',
          '6.2': '8',
          '6.1': '7',
          '6.0': 'Vista',
          '5.1': 'XP',
        };
        osVersion = versionMap[version] || version;
      }
    } else if (ua.indexOf('Mac OS X') > -1) {
      osName = 'macOS';
      osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || 'Unknown';
    } else if (ua.indexOf('Linux') > -1) {
      osName = 'Linux';
    } else if (ua.indexOf('Android') > -1) {
      osName = 'Android';
      osVersion = ua.match(/Android (\d+\.\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('iPhone OS') > -1 || ua.indexOf('iPad') > -1) {
      osName = 'iOS';
      osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || 'Unknown';
    }

    return {
      name: osName,
      version: osVersion,
    };
  }

  /**
   * 格式化时间
   * @param {Date|number} date - 日期对象或时间戳
   * @param {string} format - 格式字符串
   */
  static formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * 获取时间戳
   */
  static getTimestamp() {
    return Date.now();
  }

  /**
   * 获取ISO时间字符串
   */
  static getISOString() {
    return new Date().toISOString();
  }

  /**
   * 检查对象是否为空
   * @param {*} obj - 要检查的对象
   */
  static isEmpty(obj) {
    if (obj === null || obj === undefined) return true;
    if (typeof obj === 'string') return obj.length === 0;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }

  /**
   * 安全地获取对象属性
   * @param {Object} obj - 对象
   * @param {string} path - 属性路径
   * @param {*} defaultValue - 默认值
   */
  static safeGet(obj, path, defaultValue = undefined) {
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
   * 生成随机字符串
   * @param {number} length - 长度
   * @param {string} chars - 字符集
   */
  static randomString(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 检查是否为有效的URL
   * @param {string} url - URL字符串
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查是否为有效的邮箱
   * @param {string} email - 邮箱字符串
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 检查是否为有效的手机号
   * @param {string} phone - 手机号字符串
   */
  static isValidPhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 压缩字符串
   * @param {string} str - 要压缩的字符串
   */
  static compress(str) {
    // 简单的字符串压缩，实际项目中可以使用更复杂的压缩算法
    return str.replace(/\s+/g, ' ').trim();
  }

  /**
   * 转义HTML字符
   * @param {string} str - 要转义的字符串
   */
  static escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 反转义HTML字符
   * @param {string} str - 要反转义的字符串
   */
  static unescapeHtml(str) {
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent || div.innerText || '';
  }
}
