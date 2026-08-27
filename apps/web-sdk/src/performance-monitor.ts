/**
 * 性能监控器
 */

import type { PerformanceData, WebVitals } from './types';
import { ConfigManager } from './config';

export class PerformanceMonitor {
  private config: ConfigManager;
  private performanceObservers: PerformanceObserver[] = [];
  private webVitals: Partial<WebVitals> = {};
  private isMonitoring: boolean = false;
  private resourceTimings: PerformanceResourceTiming[] = [];
  private navigationTiming?: PerformanceNavigationTiming;
  // resourceTimings 只保留最近 N 条，避免长会话内存无限增长
  private static readonly MAX_RESOURCE_TIMINGS = 500;

  constructor(config: ConfigManager) {
    this.config = config;
  }

  /**
   * 初始化性能监控
   */
  init(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // 监控导航时间
    this.monitorNavigationTiming();

    // 监控Web Vitals
    this.monitorWebVitals();

    // 监控资源加载
    this.monitorResourceTiming();

    // 监控长任务
    this.monitorLongTasks();

    // 页面加载完成后收集性能数据
    if (document.readyState === 'complete') {
      this.collectPerformanceData();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.collectPerformanceData(), 0);
      });
    }
  }

  /**
   * 监控导航时间
   */
  private monitorNavigationTiming(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'navigation') {
              this.navigationTiming = entry as PerformanceNavigationTiming;
              this.calculateNavigationMetrics();
            }
          });
        });

        observer.observe({ entryTypes: ['navigation'] });
        this.performanceObservers.push(observer);
      } catch (error) {
        console.warn('Navigation timing monitoring not supported:', error);
      }
    }
  }

  /**
   * 监控Web Vitals
   */
  private monitorWebVitals(): void {
    if ('PerformanceObserver' in window) {
      // 监控LCP (Largest Contentful Paint)
      this.observeWebVital('largest-contentful-paint', (entry) => {
        this.webVitals.LCP = entry.startTime;
      });

      // 监控FID (First Input Delay)
      this.observeWebVital('first-input', (entry) => {
        this.webVitals.FID = (entry as any).processingStart - entry.startTime;
      });

      // 监控CLS (Cumulative Layout Shift)
      this.observeWebVital('layout-shift', (entry) => {
        if (!(entry as any).hadRecentInput) {
          this.webVitals.CLS = (this.webVitals.CLS || 0) + (entry as any).value;
        }
      });

      // 监控FCP (First Contentful Paint)
      this.observeWebVital('paint', (entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.webVitals.FCP = entry.startTime;
        }
      });
    }

    // 监控TTFB (Time to First Byte)
    this.calculateTTFB();
  }

  /**
   * 观察Web Vital指标
   */
  private observeWebVital(entryType: string, callback: (entry: PerformanceEntry) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(callback);
      });

      observer.observe({ entryTypes: [entryType] });
      this.performanceObservers.push(observer);
    } catch (error) {
      console.warn(`${entryType} monitoring not supported:`, error);
    }
  }

  /**
   * 监控资源加载时间
   */
  private monitorResourceTiming(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries() as PerformanceResourceTiming[];
          this.resourceTimings.push(...entries);

          // 只保留最近 MAX_RESOURCE_TIMINGS 条
          if (this.resourceTimings.length > PerformanceMonitor.MAX_RESOURCE_TIMINGS) {
            this.resourceTimings.splice(0, this.resourceTimings.length - PerformanceMonitor.MAX_RESOURCE_TIMINGS);
          }
          
          // 分析资源加载性能
          entries.forEach((entry) => {
            this.analyzeResourceTiming(entry);
          });
        });

        observer.observe({ entryTypes: ['resource'] });
        this.performanceObservers.push(observer);
      } catch (error) {
        console.warn('Resource timing monitoring not supported:', error);
      }
    }
  }

  /**
   * 监控长任务
   */
  private monitorLongTasks(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            this.analyzeLongTask(entry);
          });
        });

        observer.observe({ entryTypes: ['longtask'] });
        this.performanceObservers.push(observer);
      } catch (error) {
        console.warn('Long task monitoring not supported:', error);
      }
    }
  }

  /**
   * 计算导航指标
   */
  private calculateNavigationMetrics(): void {
    if (!this.navigationTiming) return;

    const timing = this.navigationTiming;
    
    // 计算各个阶段的时间
    const metrics = {
      dns_lookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcp_connection: timing.connectEnd - timing.connectStart,
      ssl_handshake: timing.secureConnectionStart > 0 ? 
        timing.connectEnd - timing.secureConnectionStart : 0,
      request_time: timing.responseStart - timing.requestStart,
      response_time: timing.responseEnd - timing.responseStart,
      dom_processing: timing.domComplete - timing.fetchStart,
      dom_content_loaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
      load_event: timing.loadEventEnd - timing.loadEventStart,
      total_time: timing.loadEventEnd - timing.fetchStart,
    };

    // 触发导航性能事件
    window.dispatchEvent(new CustomEvent('probe-x-navigation-performance', {
      detail: { metrics, timing }
    }));
  }

  /**
   * 计算TTFB
   */
  private calculateTTFB(): void {
    if (this.navigationTiming) {
      this.webVitals.TTFB = this.navigationTiming.responseStart - this.navigationTiming.fetchStart;
    }
  }

  /**
   * 分析资源加载时间
   */
  private analyzeResourceTiming(entry: PerformanceResourceTiming): void {
    const resourceType = this.getResourceType(entry.name);
    const size = entry.transferSize || entry.encodedBodySize;
    const duration = entry.duration;

    // 检查慢资源
    if (duration > 1000) { // 超过1秒
      window.dispatchEvent(new CustomEvent('probe-x-slow-resource', {
        detail: {
          name: entry.name,
          type: resourceType,
          duration,
          size,
          timing: entry,
        }
      }));
    }

    // 检查大资源
    if (size > 1024 * 1024) { // 超过1MB
      window.dispatchEvent(new CustomEvent('probe-x-large-resource', {
        detail: {
          name: entry.name,
          type: resourceType,
          size,
          duration,
          timing: entry,
        }
      }));
    }
  }

  /**
   * 分析长任务
   */
  private analyzeLongTask(entry: PerformanceEntry): void {
    window.dispatchEvent(new CustomEvent('probe-x-long-task', {
      detail: {
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name,
      }
    }));
  }

  /**
   * 获取资源类型
   */
  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase() || '';
    
    const typeMap: Record<string, string> = {
      'js': 'script',
      'mjs': 'script',
      'css': 'stylesheet',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'webp': 'image',
      'svg': 'image',
      'woff': 'font',
      'woff2': 'font',
      'ttf': 'font',
      'otf': 'font',
      'mp4': 'video',
      'webm': 'video',
      'ogg': 'video',
      'mp3': 'audio',
      'wav': 'audio',
    };

    return typeMap[extension] || 'other';
  }

  /**
   * 收集性能数据
   */
  private collectPerformanceData(): void {
    const performanceData = this.getPerformanceData();
    
    window.dispatchEvent(new CustomEvent('probe-x-performance-data', {
      detail: performanceData
    }));
  }

  /**
   * 获取性能数据
   */
  getPerformanceData(): PerformanceData {
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
      } : undefined,
      paint: paint.map(p => ({
        name: p.name,
        startTime: p.startTime,
      })),
      resources: this.resourceTimings.map(r => ({
        name: r.name,
        startTime: r.startTime,
        duration: r.duration,
        transferSize: r.transferSize,
        encodedBodySize: r.encodedBodySize,
        decodedBodySize: r.decodedBodySize,
      })),
      memory: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : undefined,
      vitals: { ...this.webVitals },
    };
  }

  /**
   * 获取Web Vitals
   */
  getWebVitals(): Partial<WebVitals> {
    return { ...this.webVitals };
  }

  /**
   * 获取资源性能统计
   */
  getResourceStats(): {
    totalResources: number;
    totalSize: number;
    totalDuration: number;
    slowResources: number;
    largeResources: number;
    byType: Record<string, { count: number; size: number; duration: number }>;
  } {
    const stats = {
      totalResources: this.resourceTimings.length,
      totalSize: 0,
      totalDuration: 0,
      slowResources: 0,
      largeResources: 0,
      byType: {} as Record<string, { count: number; size: number; duration: number }>,
    };

    this.resourceTimings.forEach((resource) => {
      const type = this.getResourceType(resource.name);
      const size = resource.transferSize || resource.encodedBodySize;
      const duration = resource.duration;

      stats.totalSize += size;
      stats.totalDuration += duration;

      if (duration > 1000) stats.slowResources++;
      if (size > 1024 * 1024) stats.largeResources++;

      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, size: 0, duration: 0 };
      }

      stats.byType[type].count++;
      stats.byType[type].size += size;
      stats.byType[type].duration += duration;
    });

    return stats;
  }

  /**
   * 获取页面加载时间线
   */
  getLoadTimeline(): Record<string, number> {
    if (!this.navigationTiming) {
      return {};
    }

    const timing = this.navigationTiming;
    const start = timing.fetchStart;

    return {
      navigation_start: 0,
      domain_lookup_start: timing.domainLookupStart - start,
      domain_lookup_end: timing.domainLookupEnd - start,
      connect_start: timing.connectStart - start,
      connect_end: timing.connectEnd - start,
      request_start: timing.requestStart - start,
      response_start: timing.responseStart - start,
      response_end: timing.responseEnd - start,
      dom_loading: timing.fetchStart - start,
      dom_interactive: timing.domInteractive - start,
      dom_content_loaded_start: timing.domContentLoadedEventStart - start,
      dom_content_loaded_end: timing.domContentLoadedEventEnd - start,
      dom_complete: timing.domComplete - start,
      load_event_start: timing.loadEventStart - start,
      load_event_end: timing.loadEventEnd - start,
    };
  }

  /**
   * 测量自定义性能指标
   */
  measure(name: string, startMark?: string, endMark?: string): number {
    try {
      if (startMark && endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        const entries = performance.getEntriesByName(name, 'measure');
        if (entries.length > 0) {
          return entries[entries.length - 1]?.duration || 0;
        }
      }
      
      const measureEntries = performance.getEntriesByName(name, 'measure');
      return measureEntries.length > 0 ? (measureEntries[measureEntries.length - 1]?.duration || 0) : 0;
    } catch (error) {
      console.warn('Performance measure failed:', error);
      return 0;
    }
  }

  /**
   * 创建性能标记
   */
  mark(name: string): void {
    try {
      performance.mark(name);
    } catch (error) {
      console.warn('Performance mark failed:', error);
    }
  }

  /**
   * 清除性能标记
   */
  clearMarks(name?: string): void {
    try {
      if (name) {
        performance.clearMarks(name);
      } else {
        performance.clearMarks();
      }
    } catch (error) {
      console.warn('Clear performance marks failed:', error);
    }
  }

  /**
   * 清除性能测量
   */
  clearMeasures(name?: string): void {
    try {
      if (name) {
        performance.clearMeasures(name);
      } else {
        performance.clearMeasures();
      }
    } catch (error) {
      console.warn('Clear performance measures failed:', error);
    }
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): any {
    const memory = (performance as any).memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usage_percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  }

  /**
   * 检查性能预算
   */
  checkPerformanceBudget(budget: {
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
  }): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    
    if (budget.lcp && this.webVitals.LCP && this.webVitals.LCP > budget.lcp) {
      violations.push(`LCP: ${this.webVitals.LCP}ms > ${budget.lcp}ms`);
    }
    
    if (budget.fid && this.webVitals.FID && this.webVitals.FID > budget.fid) {
      violations.push(`FID: ${this.webVitals.FID}ms > ${budget.fid}ms`);
    }
    
    if (budget.cls && this.webVitals.CLS && this.webVitals.CLS > budget.cls) {
      violations.push(`CLS: ${this.webVitals.CLS} > ${budget.cls}`);
    }
    
    if (budget.fcp && this.webVitals.FCP && this.webVitals.FCP > budget.fcp) {
      violations.push(`FCP: ${this.webVitals.FCP}ms > ${budget.fcp}ms`);
    }
    
    if (budget.ttfb && this.webVitals.TTFB && this.webVitals.TTFB > budget.ttfb) {
      violations.push(`TTFB: ${this.webVitals.TTFB}ms > ${budget.ttfb}ms`);
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * 销毁性能监控器
   */
  destroy(): void {
    this.performanceObservers.forEach((observer) => {
      observer.disconnect();
    });
    this.performanceObservers = [];
    
    this.isMonitoring = false;
    this.webVitals = {};
    this.resourceTimings = [];
    this.navigationTiming = undefined;
  }
}
