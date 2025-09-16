/**
 * 自动埋点跟踪器
 */

export class AutoTracker {
  constructor(config, collector) {
    this.config = config;
    this.collector = collector;
    this.isTracking = false;
    this.listeners = [];
    this.scrollTimer = null;
    this.heartbeatTimer = null;
  }

  /**
   * 开始自动跟踪
   */
  start() {
    if (this.isTracking) {
      console.warn('AutoTracker already started');
      return;
    }

    this.isTracking = true;

    // 页面访问跟踪
    if (this.config.get('autoTrackPageView', true)) {
      this.trackPageView();
    }

    // 点击事件跟踪
    if (this.config.get('autoTrackClick', true)) {
      this.trackClicks();
    }

    // 滚动事件跟踪
    if (this.config.get('autoTrackScroll', true)) {
      this.trackScroll();
    }

    // 表单事件跟踪
    if (this.config.get('autoTrackForm', true)) {
      this.trackForms();
    }

    // 错误跟踪
    if (this.config.get('enableErrorTracking', true)) {
      this.trackErrors();
    }

    // 性能跟踪
    if (this.config.get('enablePerformanceTracking', true)) {
      this.trackPerformance();
    }

    // 心跳跟踪
    if (this.config.get('enableHeartbeat', true)) {
      this.startHeartbeat();
    }

    console.log('AutoTracker started');
  }

  /**
   * 停止自动跟踪
   */
  stop() {
    if (!this.isTracking) {
      return;
    }

    this.isTracking = false;

    // 移除所有事件监听器
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];

    // 清除定时器
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    console.log('AutoTracker stopped');
  }

  /**
   * 跟踪页面访问
   */
  trackPageView() {
    // 页面加载完成时发送页面访问事件
    if (document.readyState === 'complete') {
      this.sendPageView();
    } else {
      window.addEventListener('load', () => {
        this.sendPageView();
      });
    }

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.sendPageView();
      }
    });
  }

  /**
   * 发送页面访问事件
   */
  sendPageView() {
    const event = this.collector.collectEvent('page_view', {
      page_title: document.title,
      page_url: window.location.href,
      page_path: window.location.pathname,
      referrer: document.referrer,
      load_time: performance.now(),
    });

    if (event) {
      // 直接发送，不经过队列
      this.sendEvent(event);
    }
  }

  /**
   * 跟踪点击事件
   */
  trackClicks() {
    const clickHandler = (event) => {
      const target = event.target;
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
        click_x: event.clientX,
        click_y: event.clientY,
        page_x: event.pageX,
        page_y: event.pageY,
        button: event.button,
        ctrl_key: event.ctrlKey,
        shift_key: event.shiftKey,
        alt_key: event.altKey,
        meta_key: event.metaKey,
      });

      if (clickEvent) {
        this.sendEvent(clickEvent);
      }
    };

    document.addEventListener('click', clickHandler, true);
    this.listeners.push({ element: document, event: 'click', handler: clickHandler });
  }

  /**
   * 跟踪滚动事件
   */
  trackScroll() {
    let scrollTimeout;
    
    const scrollHandler = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollEvent = this.collector.collectEvent('scroll', {
          scroll_x: window.pageXOffset || document.documentElement.scrollLeft,
          scroll_y: window.pageYOffset || document.documentElement.scrollTop,
          scroll_percentage: this.getScrollPercentage(),
          viewport_width: window.innerWidth,
          viewport_height: window.innerHeight,
          document_width: document.documentElement.scrollWidth,
          document_height: document.documentElement.scrollHeight,
        });

        if (scrollEvent) {
          this.sendEvent(scrollEvent);
        }
      }, 100); // 防抖
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
    this.listeners.push({ element: window, event: 'scroll', handler: scrollHandler });
  }

  /**
   * 跟踪表单事件
   */
  trackForms() {
    // 表单提交
    const submitHandler = (event) => {
      const form = event.target;
      const formEvent = this.collector.collectEvent('form_submit', {
        form_id: form.id,
        form_class: form.className,
        form_action: form.action,
        form_method: form.method,
        form_fields: this.getFormFields(form),
      });

      if (formEvent) {
        this.sendEvent(formEvent);
      }
    };

    // 表单字段变化
    const changeHandler = (event) => {
      const field = event.target;
      if (field.tagName === 'INPUT' || field.tagName === 'SELECT' || field.tagName === 'TEXTAREA') {
        const fieldEvent = this.collector.collectEvent('form_field_change', {
          field_type: field.type,
          field_name: field.name,
          field_id: field.id,
          field_class: field.className,
          field_value: field.value,
          field_placeholder: field.placeholder,
          form_id: field.form ? field.form.id : null,
        });

        if (fieldEvent) {
          this.sendEvent(fieldEvent);
        }
      }
    };

    document.addEventListener('submit', submitHandler, true);
    document.addEventListener('change', changeHandler, true);
    
    this.listeners.push({ element: document, event: 'submit', handler: submitHandler });
    this.listeners.push({ element: document, event: 'change', handler: changeHandler });
  }

  /**
   * 跟踪错误
   */
  trackErrors() {
    // JavaScript错误
    const errorHandler = (event) => {
      const errorEvent = this.collector.collectEvent('javascript_error', {
        error_message: event.message,
        error_filename: event.filename,
        error_lineno: event.lineno,
        error_colno: event.colno,
        error_stack: event.error ? event.error.stack : null,
      });

      if (errorEvent) {
        this.sendEvent(errorEvent);
      }
    };

    // Promise错误
    const unhandledRejectionHandler = (event) => {
      const errorEvent = this.collector.collectEvent('unhandled_promise_rejection', {
        error_reason: event.reason,
        error_promise: event.promise,
      });

      if (errorEvent) {
        this.sendEvent(errorEvent);
      }
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);
    
    this.listeners.push({ element: window, event: 'error', handler: errorHandler });
    this.listeners.push({ element: window, event: 'unhandledrejection', handler: unhandledRejectionHandler });
  }

  /**
   * 跟踪性能
   */
  trackPerformance() {
    // 页面加载性能
    window.addEventListener('load', () => {
      setTimeout(() => {
        const performanceData = this.getPerformanceData();
        const performanceEvent = this.collector.collectEvent('page_performance', performanceData);

        if (performanceEvent) {
          this.sendEvent(performanceEvent);
        }
      }, 0);
    });
  }

  /**
   * 开始心跳
   */
  startHeartbeat() {
    const interval = this.config.get('heartbeatInterval', 30000);
    
    this.heartbeatTimer = setInterval(() => {
      const heartbeatEvent = this.collector.collectEvent('heartbeat', {
        timestamp: Date.now(),
        page_visibility: document.visibilityState,
        user_agent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (heartbeatEvent) {
        this.sendEvent(heartbeatEvent);
      }
    }, interval);
  }

  /**
   * 获取元素信息
   * @param {Element} element - DOM元素
   */
  getElementInfo(element) {
    return {
      type: element.type || null,
      id: element.id || null,
      className: element.className || null,
      text: element.textContent ? element.textContent.trim().substring(0, 100) : null,
      href: element.href || null,
      src: element.src || null,
      alt: element.alt || null,
      title: element.title || null,
      value: element.value || null,
      placeholder: element.placeholder || null,
      name: element.name || null,
      tagName: element.tagName || null,
    };
  }

  /**
   * 获取表单字段
   * @param {HTMLFormElement} form - 表单元素
   */
  getFormFields(form) {
    const fields = [];
    const formData = new FormData(form);
    
    for (const [name, value] of formData.entries()) {
      fields.push({
        name,
        value: typeof value === 'string' ? value.substring(0, 100) : value,
      });
    }
    
    return fields;
  }

  /**
   * 获取滚动百分比
   */
  getScrollPercentage() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    if (documentHeight === 0) return 0;
    
    return Math.round((scrollTop / documentHeight) * 100);
  }

  /**
   * 获取性能数据
   */
  getPerformanceData() {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    
    return {
      navigation_start: navigation ? navigation.navigationStart : null,
      dom_content_loaded: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : null,
      load_complete: navigation ? navigation.loadEventEnd - navigation.navigationStart : null,
      first_paint: paint.find(p => p.name === 'first-paint') ? paint.find(p => p.name === 'first-paint').startTime : null,
      first_contentful_paint: paint.find(p => p.name === 'first-contentful-paint') ? paint.find(p => p.name === 'first-contentful-paint').startTime : null,
      connection_type: navigator.connection ? navigator.connection.effectiveType : null,
      connection_downlink: navigator.connection ? navigator.connection.downlink : null,
      connection_rtt: navigator.connection ? navigator.connection.rtt : null,
    };
  }

  /**
   * 发送事件
   * @param {Object} event - 事件对象
   */
  sendEvent(event) {
    // 这里可以调用发送器发送事件
    // 暂时通过自定义事件通知
    window.dispatchEvent(new CustomEvent('probe-x-event', { detail: event }));
  }
}
