/**
 * 数据发送器
 */

import type { ProbeXEvent } from './types';
import { ConfigManager } from './config';

export class DataSender {
  private config: ConfigManager;
  private queue: ProbeXEvent[] = [];
  private isSending: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number;
  private retryDelay: number;
  private batchSize: number;
  private flushInterval: number;
  private sendTimeout: number;
  private timer?: number;

  constructor(config: ConfigManager) {
    this.config = config;
    this.maxRetries = this.config.get('maxRetries', 3);
    this.retryDelay = this.config.get('retryDelay', 1000);
    this.batchSize = this.config.get('batchSize', 10);
    this.flushInterval = this.config.get('flushInterval', 5000);
    this.sendTimeout = this.config.get('sendTimeout', 10000);
    
    this.startFlushTimer();
  }

  /**
   * 发送事件
   */
  send(event: ProbeXEvent): void {
    if (!event) return;

    this.queue.push(event);
    
    // 如果队列达到批量大小或者是高优先级事件，立即发送
    if (this.queue.length >= this.batchSize || event.options.priority === 'high') {
      this.flush();
    }
  }

  /**
   * 批量发送
   */
  async flush(): Promise<void> {
    if (this.isSending || this.queue.length === 0) {
      return;
    }

    this.isSending = true;
    const events = this.queue.splice(0, this.batchSize);
    
    try {
      await this.sendBatch(events);
      this.retryCount = 0;
      
      if (this.config.get('debug')) {
        console.log('ProbeX: Events sent successfully', events);
      }
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
        console.error('ProbeX: Max retries exceeded, events lost:', events);
        this.retryCount = 0;
      }
    }

    this.isSending = false;
  }

  /**
   * 发送批量数据
   */
  private async sendBatch(events: ProbeXEvent[]): Promise<void> {
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
      batchId: this.generateBatchId(),
      sdk: {
        name: 'probe-x-web-sdk',
        version: '2.0.0',
      },
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
   */
  private prepareEvent(event: ProbeXEvent): any {
    return {
      eventName: event.eventName,
      ip: this.getClientIP(),
      ua: event.device.userAgent,
      webSite: window.location.hostname,
      webPathname: event.page.path,
      webParams: JSON.stringify(event.properties),
      deviceId: this.getDeviceId(),
      referrer: event.page.referrer,
      utmSource: this.getUTMParameter('utm_source'),
      utmMedium: this.getUTMParameter('utm_medium'),
      utmCampaign: this.getUTMParameter('utm_campaign'),
      utmTerm: this.getUTMParameter('utm_term'),
      utmContent: this.getUTMParameter('utm_content'),
      logTime: event.logTime,
      serviceTime: new Date().toISOString(),
      screenWidth: event.device.screen.width,
      screenHeight: event.device.screen.height,
      pixelRatio: event.device.screen.pixelRatio,
      device: this.getDeviceType(),
      elementId: event.properties.element_id || '',
      uid: event.user.user_id || -1,
      language: event.device.language,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: event.device.viewport.height,
      viewportWidth: event.device.viewport.width,
      zoon: event.device.screen.pixelRatio,
      data: event.properties,
      rawData: event,
      source: 'web-sdk',
    };
  }

  /**
   * 发送HTTP请求
   */
  private async makeRequest(url: string, data: any): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.sendTimeout);

    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    };

    try {
      // 优先使用fetch
      if (typeof fetch !== 'undefined') {
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        return response;
      }

      // 降级到XMLHttpRequest
      return await this.xhrRequest(url, options);
    } catch (error) {
      clearTimeout(timeoutId);
      
      // 如果是网络错误，尝试使用Beacon API作为降级方案
      if (this.isNetworkError(error) && this.canUseBeacon()) {
        return this.beaconRequest(url, data);
      }
      
      throw error;
    }
  }

  /**
   * XMLHttpRequest请求
   */
  private xhrRequest(url: string, options: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open(options.method || 'GET', url, true);
      
      // 设置请求头
      if (options.headers) {
        Object.entries(options.headers as Record<string, string>).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
      }

      xhr.timeout = this.sendTimeout;

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            statusText: xhr.statusText,
            text: () => Promise.resolve(xhr.responseText),
            json: () => Promise.resolve(JSON.parse(xhr.responseText)),
          } as Response);
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Request timeout'));
      };

      xhr.send(options.body as string);
    });
  }

  /**
   * Beacon API请求（降级方案）
   */
  private beaconRequest(url: string, data: any): Promise<Response> {
    return new Promise((resolve, reject) => {
      try {
        const success = navigator.sendBeacon(url, JSON.stringify(data));
        if (success) {
          resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
          } as Response);
        } else {
          reject(new Error('Beacon send failed'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 检查是否为网络错误
   */
  private isNetworkError(error: any): boolean {
    return error instanceof TypeError || 
           error.message.includes('network') ||
           error.message.includes('fetch');
  }

  /**
   * 检查是否可以使用Beacon API
   */
  private canUseBeacon(): boolean {
    return typeof navigator !== 'undefined' && 
           typeof navigator.sendBeacon === 'function';
  }

  /**
   * 生成批次ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取客户端IP（通过第三方服务）
   */
  private getClientIP(): string {
    // 这里可以集成第三方IP服务
    // 暂时返回空字符串
    return '';
  }

  /**
   * 获取设备ID
   */
  private getDeviceId(): string {
    const deviceKey = this.config.getStorageKey('device_id');
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
  private generateDeviceId(): string {
    // 使用Canvas指纹生成设备ID
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('ProbeX Device ID', 2, 2);
        
        const fingerprint = canvas.toDataURL();
        return btoa(fingerprint).substring(0, 32);
      }
    } catch (error) {
      // Canvas指纹生成失败，使用随机字符串
      console.warn('Canvas fingerprint generation failed:', error);
    }
    
    // 降级方案：使用随机字符串 + 时间戳
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取设备类型
   */
  private getDeviceType(): string {
    const ua = navigator.userAgent;
    
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      if (/iPad/i.test(ua)) {
        return 'tablet';
      }
      return 'mobile';
    }
    
    return 'desktop';
  }

  /**
   * 获取UTM参数
   */
  private getUTMParameter(param: string): string {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param) || '';
    } catch (error) {
      return '';
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    this.timer = window.setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * 停止定时刷新
   */
  private stopFlushTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * 获取发送统计
   */
  getStats(): { queueLength: number; retryCount: number; isSending: boolean } {
    return {
      queueLength: this.queue.length,
      retryCount: this.retryCount,
      isSending: this.isSending,
    };
  }

  /**
   * 销毁发送器
   */
  destroy(): void {
    this.stopFlushTimer();
    
    // 最后一次发送队列中的数据
    if (this.queue.length > 0) {
      this.flush();
    }
    
    this.clearQueue();
  }
}
