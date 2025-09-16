/**
 * 数据发送器
 */

export class DataSender {
  constructor(config) {
    this.config = config;
    this.queue = [];
    this.isSending = false;
    this.retryCount = 0;
    this.maxRetries = this.config.get('maxRetries', 3);
    this.retryDelay = this.config.get('retryDelay', 1000);
    this.batchSize = this.config.get('batchSize', 10);
    this.flushInterval = this.config.get('flushInterval', 5000);
    
    this.startFlushTimer();
  }

  /**
   * 发送事件
   * @param {Object} event - 事件对象
   */
  send(event) {
    if (!event) return;

    this.queue.push(event);
    
    // 如果队列达到批量大小，立即发送
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * 批量发送
   */
  async flush() {
    if (this.isSending || this.queue.length === 0) {
      return;
    }

    this.isSending = true;
    const events = this.queue.splice(0, this.batchSize);
    
    try {
      await this.sendBatch(events);
      this.retryCount = 0;
    } catch (error) {
      console.error('ProbeX send error:', error);
      
      // 重试逻辑
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => {
          this.queue.unshift(...events); // 重新加入队列
          this.isSending = false;
          this.flush();
        }, this.retryDelay * this.retryCount);
        return;
      } else {
        // 重试失败，记录错误
        console.error('ProbeX max retries exceeded');
      }
    }

    this.isSending = false;
  }

  /**
   * 发送批量数据
   * @param {Array} events - 事件数组
   */
  async sendBatch(events) {
    const apiUrl = this.config.get('apiUrl');
    const appId = this.config.get('appId');
    const debug = this.config.get('debug', false);

    if (!apiUrl) {
      throw new Error('API URL not configured');
    }

    if (!appId) {
      throw new Error('App ID not configured');
    }

    // 准备发送数据
    const payload = {
      appId,
      events: events.map(event => this.prepareEvent(event)),
      timestamp: Date.now(),
    };

    if (debug) {
      console.log('ProbeX sending data:', payload);
    }

    // 发送数据
    const response = await this.makeRequest(apiUrl, payload);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (debug) {
      console.log('ProbeX data sent successfully');
    }
  }

  /**
   * 准备事件数据
   * @param {Object} event - 原始事件
   */
  prepareEvent(event) {
    return {
      eventName: event.eventName,
      ip: this.getClientIP(),
      ua: event.device.userAgent,
      site: window.location.hostname,
      path: event.page.path,
      params: JSON.stringify(event.properties),
      deviceId: this.getDeviceId(),
      referrer: event.page.referrer,
      utmSource: this.getUTMParameter('utm_source'),
      utmMedium: this.getUTMParameter('utm_medium'),
      utmCampaign: this.getUTMParameter('utm_campaign'),
      utmTerm: this.getUTMParameter('utm_term'),
      utmContent: this.getUTMParameter('utm_content'),
      logTime: event.logTime,
      serviceTime: new Date().toISOString(),
      rawData: event,
      source: 'web-sdk',
    };
  }

  /**
   * 发送HTTP请求
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   */
  async makeRequest(url, data) {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };

    // 使用fetch发送请求
    if (typeof fetch !== 'undefined') {
      return await fetch(url, options);
    }

    // 降级到XMLHttpRequest
    return await this.xhrRequest(url, options);
  }

  /**
   * XMLHttpRequest请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   */
  xhrRequest(url, options) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open(options.method, url, true);
      
      // 设置请求头
      Object.keys(options.headers).forEach(key => {
        xhr.setRequestHeader(key, options.headers[key]);
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              ok: true,
              status: xhr.status,
              statusText: xhr.statusText,
            });
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error'));
      };

      xhr.send(options.body);
    });
  }

  /**
   * 获取客户端IP（通过第三方服务）
   */
  getClientIP() {
    // 这里可以集成第三方IP服务
    // 暂时返回空字符串
    return '';
  }

  /**
   * 获取设备ID
   */
  getDeviceId() {
    const deviceKey = 'probe_x_device_id';
    let deviceId = localStorage.getItem(deviceKey);
    
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem(deviceKey, deviceId);
    }
    
    return deviceId;
  }

  /**
   * 生成设备ID
   */
  generateDeviceId() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('ProbeX Device ID', 2, 2);
    
    const fingerprint = canvas.toDataURL();
    return btoa(fingerprint).substring(0, 32);
  }

  /**
   * 获取UTM参数
   * @param {string} param - 参数名
   */
  getUTMParameter(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || '';
  }

  /**
   * 启动定时刷新
   */
  startFlushTimer() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * 停止定时刷新
   */
  stopFlushTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * 获取队列长度
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * 清空队列
   */
  clearQueue() {
    this.queue = [];
  }

  /**
   * 销毁发送器
   */
  destroy() {
    this.stopFlushTimer();
    this.clearQueue();
  }
}
