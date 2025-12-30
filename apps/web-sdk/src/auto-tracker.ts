/**
 * 自动埋点跟踪器
 */

import type { ElementInfo, FormField, PerformanceData } from './types';
import { ConfigManager } from './config';
import { EventCollector } from './collector';

interface EventListener {
  element: EventTarget;
  event: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

export class AutoTracker {
  private config: ConfigManager;
  private collector: EventCollector;
  private isTracking: boolean = false;
  private listeners: EventListener[] = [];
  private scrollTimer?: number;
  private heartbeatTimer?: number;
  private resizeTimer?: number;
  private mutationObserver?: MutationObserver;
  private intersectionObserver?: IntersectionObserver;
  private performanceObserver?: PerformanceObserver;

  constructor(config: ConfigManager, collector: EventCollector) {
    this.config = config;
    this.collector = collector;
  }

  /**
   * 开始自动跟踪
   */
  start(): void {
    if (this.isTracking) {
      console.warn('AutoTracker already started');
      return;
    }

    this.isTracking = true;

    // 页面访问跟踪
    if (this.config.isFeatureEnabled('pageView')) {
      this.trackPageView();
    }

    // 点击事件跟踪
    if (this.config.isFeatureEnabled('click')) {
      this.trackClicks();
    }

    // 滚动事件跟踪
    if (this.config.isFeatureEnabled('scroll')) {
      this.trackScroll();
    }

    // 表单事件跟踪
    if (this.config.isFeatureEnabled('form')) {
      this.trackForms();
    }

    // Hash变化跟踪
    if (this.config.isFeatureEnabled('hashChange')) {
      this.trackHashChange();
    }

    // 页面卸载跟踪
    if (this.config.isFeatureEnabled('unload')) {
      this.trackUnload();
    }

    // 错误跟踪
    if (this.config.isFeatureEnabled('error')) {
      this.trackErrors();
    }

    // 性能跟踪
    if (this.config.isFeatureEnabled('performance')) {
      this.trackPerformance();
    }

    // 网络请求跟踪
    if (this.config.isFeatureEnabled('network')) {
      this.trackNetworkRequests();
    }

    // 资源加载跟踪
    if (this.config.isFeatureEnabled('resource')) {
      this.trackResourceLoading();
    }

    // 心跳跟踪
    if (this.config.isFeatureEnabled('heartbeat')) {
      this.startHeartbeat();
    }

    // DOM变化跟踪
    this.trackDOMChanges();

    // 视口变化跟踪
    this.trackViewportChanges();

    // 元素可见性跟踪
    this.trackElementVisibility();

    console.log('AutoTracker started');
  }

  /**
   * 停止自动跟踪
   */
  stop(): void {
    if (!this.isTracking) {
      return;
    }

    this.isTracking = false;

    // 移除所有事件监听器
    this.listeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.listeners = [];

    // 清除定时器
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }

    // 断开观察器
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    console.log('AutoTracker stopped');
  }

  /**
   * 跟踪页面访问
   */
  private trackPageView(): void {
    const sendPageView = () => {
      const event = this.collector.collectEvent('page_view', {
        page_title: document.title,
        page_url: window.location.href,
        page_path: window.location.pathname,
        referrer: document.referrer,
        load_time: performance.now(),
        user_agent: navigator.userAgent,
        language: navigator.language,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      });

      if (event) {
        this.sendEvent(event);
      }
    };

    // 页面加载完成时发送页面访问事件
    if (document.readyState === 'complete') {
      sendPageView();
    } else {
      const loadHandler = () => {
        sendPageView();
      };
      window.addEventListener('load', loadHandler);
      this.listeners.push({ element: window, event: 'load', handler: loadHandler });
    }

    // 监听页面可见性变化
    const visibilityHandler = () => {
      if (!document.hidden) {
        sendPageView();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    this.listeners.push({ element: document, event: 'visibilitychange', handler: visibilityHandler });
  }

  /**
   * 跟踪点击事件
   */
  private trackClicks(): void {
    const clickHandler = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target as Element;
      const element = this.getElementInfo(target);
      
      const clickEvent = this.collector.collectEvent('click', {
        element_type: element.type,
        element_id: element.id,
        element_class: element.className,
        element_text: element.text,
        element_href: element.href,
        element_src: element.src,
        element_alt: element.alt,
        element_title: element.title,
        element_value: element.value,
        element_placeholder: element.placeholder,
        element_name: element.name,
        element_tag: element.tagName,
        element_xpath: element.xpath,
        element_selector: element.selector,
        click_x: mouseEvent.clientX,
        click_y: mouseEvent.clientY,
        page_x: mouseEvent.pageX,
        page_y: mouseEvent.pageY,
        button: mouseEvent.button,
        ctrl_key: mouseEvent.ctrlKey,
        shift_key: mouseEvent.shiftKey,
        alt_key: mouseEvent.altKey,
        meta_key: mouseEvent.metaKey,
        timestamp: Date.now(),
      });

      if (clickEvent) {
        this.sendEvent(clickEvent);
      }
    };

    document.addEventListener('click', clickHandler, true);
    this.listeners.push({ element: document, event: 'click', handler: clickHandler, options: true });
  }

  /**
   * 跟踪滚动事件
   */
  private trackScroll(): void {
    let lastScrollTime = 0;
    
    const scrollHandler = () => {
      const now = Date.now();
      if (now - lastScrollTime < 100) return; // 节流
      lastScrollTime = now;

      clearTimeout(this.scrollTimer);
      this.scrollTimer = window.setTimeout(() => {
        const scrollEvent = this.collector.collectEvent('scroll', {
          scroll_x: window.pageXOffset || document.documentElement.scrollLeft,
          scroll_y: window.pageYOffset || document.documentElement.scrollTop,
          scroll_percentage: this.getScrollPercentage(),
          viewport_width: window.innerWidth,
          viewport_height: window.innerHeight,
          document_width: document.documentElement.scrollWidth,
          document_height: document.documentElement.scrollHeight,
          scroll_direction: this.getScrollDirection(),
          scroll_speed: this.getScrollSpeed(),
        });

        if (scrollEvent) {
          this.sendEvent(scrollEvent);
        }
      }, 150); // 防抖
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
    this.listeners.push({ element: window, event: 'scroll', handler: scrollHandler, options: { passive: true } });
  }

  /**
   * 跟踪表单事件
   */
  private trackForms(): void {
    // 表单提交
    const submitHandler = (event: Event) => {
      const form = event.target as HTMLFormElement;
      const formEvent = this.collector.collectEvent('form_submit', {
        form_id: form.id,
        form_class: form.className,
        form_action: form.action,
        form_method: form.method,
        form_fields: this.getFormFields(form),
        form_validation: this.validateForm(form),
      });

      if (formEvent) {
        this.sendEvent(formEvent);
      }
    };

    // 表单字段变化
    const changeHandler = (event: Event) => {
      const field = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(field.tagName)) {
        const fieldEvent = this.collector.collectEvent('form_field_change', {
          field_type: (field as HTMLInputElement).type || field.tagName.toLowerCase(),
          field_name: field.name,
          field_id: field.id,
          field_class: field.className,
          field_value: this.maskFieldValue(field),
          field_placeholder: (field as HTMLInputElement).placeholder,
          form_id: (field.form && field.form.id) || null,
          validation_state: this.getFieldValidationState(field),
        });

        if (fieldEvent) {
          this.sendEvent(fieldEvent);
        }
      }
    };

    // 表单字段焦点
    const focusHandler = (event: Event) => {
      const field = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(field.tagName)) {
        const focusEvent = this.collector.collectEvent('form_field_focus', {
          field_type: (field as HTMLInputElement).type || field.tagName.toLowerCase(),
          field_name: field.name,
          field_id: field.id,
          form_id: (field.form && field.form.id) || null,
        });

        if (focusEvent) {
          this.sendEvent(focusEvent);
        }
      }
    };

    document.addEventListener('submit', submitHandler, true);
    document.addEventListener('change', changeHandler, true);
    document.addEventListener('focus', focusHandler, true);
    
    this.listeners.push({ element: document, event: 'submit', handler: submitHandler, options: true });
    this.listeners.push({ element: document, event: 'change', handler: changeHandler, options: true });
    this.listeners.push({ element: document, event: 'focus', handler: focusHandler, options: true });
  }

  /**
   * 跟踪Hash变化
   */
  private trackHashChange(): void {
    const hashChangeHandler = () => {
      const hashEvent = this.collector.collectEvent('hash_change', {
        old_hash: this.previousHash || '',
        new_hash: window.location.hash,
        page_url: window.location.href,
        page_path: window.location.pathname,
      });

      if (hashEvent) {
        this.sendEvent(hashEvent);
      }

      this.previousHash = window.location.hash;
    };

    window.addEventListener('hashchange', hashChangeHandler);
    this.listeners.push({ element: window, event: 'hashchange', handler: hashChangeHandler });
  }

  private previousHash: string = window.location.hash;

  /**
   * 跟踪页面卸载
   */
  private trackUnload(): void {
    const unloadHandler = () => {
      const unloadEvent = this.collector.collectEvent('page_unload', {
        page_url: window.location.href,
        page_path: window.location.pathname,
        session_duration: Date.now() - this.sessionStartTime,
        page_stay_time: Date.now() - this.pageStartTime,
      });

      if (unloadEvent) {
        this.sendEvent(unloadEvent);
      }
    };

    window.addEventListener('beforeunload', unloadHandler);
    window.addEventListener('pagehide', unloadHandler);
    
    this.listeners.push({ element: window, event: 'beforeunload', handler: unloadHandler });
    this.listeners.push({ element: window, event: 'pagehide', handler: unloadHandler });
  }

  private sessionStartTime: number = Date.now();
  private pageStartTime: number = Date.now();

  /**
   * 跟踪错误
   */
  private trackErrors(): void {
    // JavaScript错误
    const errorHandler = (event: ErrorEvent) => {
      const errorEvent = this.collector.collectEvent('javascript_error', {
        error_message: event.message,
        error_filename: event.filename,
        error_lineno: event.lineno,
        error_colno: event.colno,
        error_stack: event.error ? event.error.stack : null,
        user_agent: navigator.userAgent,
        page_url: window.location.href,
      });

      if (errorEvent) {
        this.sendEvent(errorEvent);
      }
    };

    // Promise错误
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      const errorEvent = this.collector.collectEvent('unhandled_promise_rejection', {
        error_reason: String(event.reason),
        error_promise: event.promise.toString(),
        page_url: window.location.href,
      });

      if (errorEvent) {
        this.sendEvent(errorEvent);
      }
    };

    // 资源加载错误
    const resourceErrorHandler = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target && target instanceof HTMLElement) {
        const resourceEvent = this.collector.collectEvent('resource_error', {
          resource_type: target.tagName.toLowerCase(),
          resource_src: (target as any).src || (target as any).href,
          resource_id: target.id,
          resource_class: target.className,
          page_url: window.location.href,
        });

        if (resourceEvent) {
          this.sendEvent(resourceEvent);
        }
      }
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);
    window.addEventListener('error', resourceErrorHandler, true);
    
    this.listeners.push({ element: window, event: 'error', handler: errorHandler as EventListenerOrEventListenerObject });
    this.listeners.push({ element: window, event: 'unhandledrejection', handler: unhandledRejectionHandler as EventListenerOrEventListenerObject });
    this.listeners.push({ element: window, event: 'error', handler: resourceErrorHandler, options: true });
  }

  /**
   * 跟踪性能
   */
  private trackPerformance(): void {
    // 页面加载性能
    const loadHandler = () => {
      setTimeout(() => {
        const performanceData = this.getPerformanceData();
        const performanceEvent = this.collector.collectEvent('page_performance', performanceData);

        if (performanceEvent) {
          this.sendEvent(performanceEvent);
        }
      }, 0);
    };

    window.addEventListener('load', loadHandler);
    this.listeners.push({ element: window, event: 'load', handler: loadHandler });

    // 使用PerformanceObserver监听性能指标
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              this.collector.collectEvent('lcp_measurement', {
                lcp_value: entry.startTime,
                lcp_element: (entry as any).element?.tagName,
              });
            }
          });
        });

        this.performanceObserver.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      } catch (error) {
        console.warn('PerformanceObserver not supported:', error);
      }
    }
  }

  /**
   * 跟踪网络请求
   */
  private trackNetworkRequests(): void {
    // 拦截fetch请求
    if (typeof window.fetch !== 'undefined') {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const startTime = Date.now();
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        
        try {
          const response = await originalFetch(...args);
          const duration = Date.now() - startTime;
          
          this.collector.collectEvent('network_request', {
            url,
            method: args[1]?.method || 'GET',
            status: response.status,
            duration,
            success: response.ok,
            response_size: response.headers.get('content-length') || 0,
          });
          
          return response;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          this.collector.collectEvent('network_error', {
            url,
            method: args[1]?.method || 'GET',
            error: (error as Error).message,
            duration,
          });
          
          throw error;
        }
      };
    }

    // 拦截XMLHttpRequest
    if (typeof XMLHttpRequest !== 'undefined') {
      const collector = this.collector; // 通过闭包保存collector引用
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(method: string, url: string, async: boolean = true, username?: string | null, password?: string | null) {
        (this as any)._trackingData = { method, url, startTime: 0 };
        return originalOpen.call(this, method, url, async, username, password);
      };
      
      XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
        const trackingData = (this as any)._trackingData;
        if (trackingData) {
          trackingData.startTime = Date.now();
          
          this.addEventListener('loadend', () => {
            const duration = Date.now() - trackingData.startTime;
            
            if (this.status >= 200 && this.status < 400) {
              collector.collectEvent('network_request', {
                url: trackingData.url,
                method: trackingData.method,
                status: this.status,
                duration,
                success: true,
                response_size: this.responseText?.length || 0,
              });
            } else {
              collector.collectEvent('network_error', {
                url: trackingData.url,
                method: trackingData.method,
                status: this.status,
                duration,
                error: this.statusText,
              });
            }
          });
        }
        
        return originalSend.call(this, body);
      };
    }
  }

  /**
   * 跟踪资源加载
   */
  private trackResourceLoading(): void {
    // 使用PerformanceObserver监听资源加载
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              this.collector.collectEvent('resource_load', {
                resource_name: resourceEntry.name,
                resource_type: this.getResourceType(resourceEntry.name),
                duration: resourceEntry.duration,
                transfer_size: resourceEntry.transferSize,
                encoded_size: resourceEntry.encodedBodySize,
                decoded_size: resourceEntry.decodedBodySize,
                start_time: resourceEntry.startTime,
              });
            }
          });
        });

        resourceObserver.observe({ entryTypes: ['resource'] });
      } catch (error) {
        console.warn('Resource PerformanceObserver not supported:', error);
      }
    }
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    const interval = this.config.get('heartbeatInterval', 30000);
    
    this.heartbeatTimer = window.setInterval(() => {
      const heartbeatEvent = this.collector.collectEvent('heartbeat', {
        timestamp: Date.now(),
        page_visibility: document.visibilityState,
        user_agent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        online_status: navigator.onLine,
        battery_level: this.getBatteryLevel(),
        memory_usage: this.getMemoryUsage(),
      });

      if (heartbeatEvent) {
        this.sendEvent(heartbeatEvent);
      }
    }, interval);
  }

  /**
   * 跟踪DOM变化
   */
  private trackDOMChanges(): void {
    if ('MutationObserver' in window) {
      this.mutationObserver = new MutationObserver((mutations) => {
        const significantChanges = mutations.filter(mutation => 
          mutation.type === 'childList' && 
          (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
        );

        if (significantChanges.length > 0) {
          this.collector.collectEvent('dom_change', {
            mutations_count: significantChanges.length,
            added_nodes: significantChanges.reduce((sum, m) => sum + m.addedNodes.length, 0),
            removed_nodes: significantChanges.reduce((sum, m) => sum + m.removedNodes.length, 0),
          });
        }
      });

      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
      });
    }
  }

  /**
   * 跟踪视口变化
   */
  private trackViewportChanges(): void {
    const resizeHandler = () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        this.collector.collectEvent('viewport_change', {
          viewport_width: window.innerWidth,
          viewport_height: window.innerHeight,
          screen_width: screen.width,
          screen_height: screen.height,
          device_pixel_ratio: window.devicePixelRatio,
        });
      }, 300);
    };

    window.addEventListener('resize', resizeHandler);
    this.listeners.push({ element: window, event: 'resize', handler: resizeHandler });
  }

  /**
   * 跟踪元素可见性
   */
  private trackElementVisibility(): void {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          this.collector.collectEvent('element_visibility', {
            element_id: element.id,
            element_class: element.className,
            element_tag: element.tagName,
            is_visible: entry.isIntersecting,
            intersection_ratio: entry.intersectionRatio,
            element_selector: this.getElementSelector(element),
          });
        });
      }, {
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      });

      // 观察重要元素
      document.querySelectorAll('[data-track-visibility]').forEach((element) => {
        this.intersectionObserver!.observe(element);
      });
    }
  }

  /**
   * 获取元素信息
   */
  private getElementInfo(element: Element): ElementInfo {
    return {
      type: (element as HTMLInputElement).type || null,
      id: element.id || null,
      className: element.className || null,
      text: element.textContent ? element.textContent.trim().substring(0, 100) : null,
      href: (element as HTMLAnchorElement).href || null,
      src: (element as HTMLImageElement).src || null,
      alt: (element as HTMLImageElement).alt || null,
      title: element.getAttribute('title') || null,
      value: (element as HTMLInputElement).value || null,
      placeholder: (element as HTMLInputElement).placeholder || null,
      name: (element as HTMLInputElement).name || null,
      tagName: element.tagName || null,
      xpath: this.getElementXPath(element),
      selector: this.getElementSelector(element),
    };
  }

  /**
   * 获取元素XPath
   */
  private getElementXPath(element: Element): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }
      
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }

  /**
   * 获取元素CSS选择器
   */
  private getElementSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current.parentElement && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.className) {
        selector += '.' + current.className.split(' ').join('.');
      }
      
      parts.unshift(selector);
      current = current.parentElement;
    }
    
    return parts.join(' > ');
  }

  /**
   * 获取表单字段
   */
  private getFormFields(form: HTMLFormElement): FormField[] {
    const fields: FormField[] = [];
    const formData = new FormData(form);
    
    for (const [name, value] of formData.entries()) {
      const field = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
      fields.push({
        name,
        value: this.maskFieldValue(field),
        type: field?.type || 'unknown',
      });
    }
    
    return fields;
  }

  /**
   * 脱敏字段值
   */
  private maskFieldValue(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
    if (!this.config.get('maskSensitiveData', true)) {
      return field.value;
    }

    const sensitiveTypes = ['password', 'email', 'tel', 'credit-card'];
    const sensitiveNames = ['password', 'pwd', 'email', 'phone', 'tel', 'credit', 'card', 'ssn'];
    
    const fieldType = (field as HTMLInputElement).type?.toLowerCase() || '';
    const fieldName = field.name?.toLowerCase() || '';
    
    if (sensitiveTypes.includes(fieldType) || 
        sensitiveNames.some(name => fieldName.includes(name))) {
      return '***';
    }
    
    return field.value.substring(0, 100); // 限制长度
  }

  /**
   * 验证表单
   */
  private validateForm(form: HTMLFormElement): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach((input) => {
      const field = input as HTMLInputElement;
      if (!field.checkValidity()) {
        errors.push(`${field.name || field.id}: ${field.validationMessage}`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取字段验证状态
   */
  private getFieldValidationState(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
    if (field.validity) {
      if (field.validity.valid) return 'valid';
      if (field.validity.valueMissing) return 'required';
      if (field.validity.typeMismatch) return 'type_mismatch';
      if (field.validity.patternMismatch) return 'pattern_mismatch';
      if (field.validity.tooLong) return 'too_long';
      if (field.validity.tooShort) return 'too_short';
      if (field.validity.rangeOverflow) return 'range_overflow';
      if (field.validity.rangeUnderflow) return 'range_underflow';
      return 'invalid';
    }
    return 'unknown';
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
   * 获取滚动方向
   */
  private getScrollDirection(): string {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    const direction = currentScrollY > (this.lastScrollY || 0) ? 'down' : 'up';
    this.lastScrollY = currentScrollY;
    return direction;
  }

  private lastScrollY: number = 0;

  /**
   * 获取滚动速度
   */
  private getScrollSpeed(): number {
    const now = Date.now();
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    const timeDiff = now - (this.lastScrollTime || now);
    const scrollDiff = Math.abs(currentScrollY - (this.lastScrollPosition || currentScrollY));
    
    this.lastScrollTime = now;
    this.lastScrollPosition = currentScrollY;
    
    return timeDiff > 0 ? scrollDiff / timeDiff : 0;
  }

  private lastScrollTime: number = 0;
  private lastScrollPosition: number = 0;

  /**
   * 获取性能数据
   */
  private getPerformanceData(): PerformanceData {
    if (!window.performance) {
      return {} as PerformanceData;
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
      } : undefined,
      paint: paint.map(p => ({
        name: p.name,
        startTime: p.startTime,
      })),
      memory: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : undefined,
    };
  }

  /**
   * 获取资源类型
   */
  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase() || '';
    
    if (['js', 'mjs'].includes(extension)) return 'script';
    if (['css'].includes(extension)) return 'stylesheet';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return 'image';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension)) return 'font';
    if (['mp4', 'webm', 'ogg'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(extension)) return 'audio';
    
    return 'other';
  }

  /**
   * 获取电池电量
   */
  private getBatteryLevel(): number | null {
    const battery = (navigator as any).battery;
    return battery ? battery.level : null;
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): any {
    const memory = (performance as any).memory;
    return memory ? {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    } : null;
  }

  /**
   * 发送事件
   */
  private sendEvent(event: any): void {
    // 通过自定义事件通知
    window.dispatchEvent(new CustomEvent('probe-x-event', { detail: event }));
  }
}
