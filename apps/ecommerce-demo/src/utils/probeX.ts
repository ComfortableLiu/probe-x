// 简化的Probe-X SDK集成
// 由于SDK还在开发中，这里使用模拟实现

// 模拟ProbeX类
class MockProbeX {
  private config: any;
  private isInitialized: boolean = false;

  constructor(config: any) {
    this.config = config;
    this.init();
  }

  private init() {
    if (this.isInitialized) {
      console.warn('ProbeX SDK already initialized');
      return;
    }

    this.isInitialized = true;
    console.log('ProbeX SDK initialized with config:', this.config);
  }

  track(eventName: string, properties: any = {}, options: any = {}) {
    if (!this.isInitialized) {
      console.warn('ProbeX SDK not initialized');
      return;
    }

    try {
      const event = {
        eventName,
        properties: {
          ...this.config.userProperties,
          ...properties,
          timestamp: new Date().toISOString(),
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        },
        options: {
          ...options,
        },
      };

      // 模拟发送事件到API
      this.sendEvent(event);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  setUser(userProperties: any) {
    this.config.userProperties = {
      ...this.config.userProperties,
      ...userProperties,
    };
  }

  private sendEvent(event: any) {
    // 模拟发送事件到API
    if (this.config.debug) {
      console.log('Sending event to API:', this.config.apiUrl, event);
    }

    // 这里可以实际发送到API
    // fetch(this.config.apiUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event),
    // });
  }
}

// 全局ProbeX实例
let probeXInstance: MockProbeX | null = null;

// 初始化Probe-X SDK
export const initProbeX = () => {
  if (probeXInstance) {
    return probeXInstance;
  }

  const config = {
    apiUrl: 'http://localhost:3001/api/data/track',
    appId: 'ecommerce-demo',
    debug: true,
    userProperties: {
      user_id: 'demo-user',
      session_id: Date.now().toString(),
    },
  };

  probeXInstance = new MockProbeX(config);
  return probeXInstance;
};

// 获取ProbeX实例
export const getProbeX = (): MockProbeX => {
  if (!probeXInstance) {
    return initProbeX();
  }
  return probeXInstance;
};

// 埋点事件跟踪函数
export const trackEvent = (eventName: string, properties: any = {}) => {
  const probeX = getProbeX();
  probeX.track(eventName, properties);
};

// 设置用户属性
export const setUserProperties = (userProperties: any) => {
  const probeX = getProbeX();
  probeX.setUser(userProperties);
};

// 页面访问埋点
export const trackPageView = (pageName: string, additionalProperties: any = {}) => {
  trackEvent('page_view', {
    page_name: pageName,
    page_url: window.location.href,
    referrer: document.referrer,
    ...additionalProperties,
  });
};

// 商品浏览埋点
export const trackProductView = (product: any, additionalProperties: any = {}) => {
  trackEvent('product_view', {
    product_id: product.id,
    product_name: product.name,
    product_category: product.category,
    product_brand: product.brand,
    product_price: product.price,
    ...additionalProperties,
  });
};

// 商品点击埋点
export const trackProductClick = (product: any, clickType: string = 'card', additionalProperties: any = {}) => {
  trackEvent('product_click', {
    product_id: product.id,
    product_name: product.name,
    product_category: product.category,
    product_brand: product.brand,
    product_price: product.price,
    click_type: clickType,
    ...additionalProperties,
  });
};

// 添加到购物车埋点
export const trackAddToCart = (product: any, quantity: number = 1, additionalProperties: any = {}) => {
  trackEvent('add_to_cart', {
    product_id: product.id,
    product_name: product.name,
    product_category: product.category,
    product_brand: product.brand,
    product_price: product.price,
    quantity: quantity,
    total_value: product.price * quantity,
    ...additionalProperties,
  });
};

// 购物车操作埋点
export const trackCartAction = (action: string, product?: any, quantity?: number, additionalProperties: any = {}) => {
  const eventProperties: any = {
    action: action,
    ...additionalProperties,
  };

  if (product) {
    eventProperties.product_id = product.id;
    eventProperties.product_name = product.name;
    eventProperties.product_price = product.price;
  }

  if (quantity !== undefined) {
    eventProperties.quantity = quantity;
  }

  trackEvent('cart_action', eventProperties);
};

// 搜索埋点
export const trackSearch = (keyword: string, resultsCount: number = 0, additionalProperties: any = {}) => {
  trackEvent('search', {
    keyword: keyword,
    results_count: resultsCount,
    ...additionalProperties,
  });
};

// 购买埋点
export const trackPurchase = (order: any, additionalProperties: any = {}) => {
  trackEvent('purchase', {
    order_id: order.id,
    order_number: order.orderNumber,
    total_amount: order.finalAmount,
    item_count: order.items.length,
    payment_method: order.paymentMethod,
    ...additionalProperties,
  });
};

// 用户注册埋点
export const trackUserRegister = (user: any, additionalProperties: any = {}) => {
  trackEvent('user_register', {
    user_id: user.id,
    register_method: 'email',
    ...additionalProperties,
  });
};

// 用户登录埋点
export const trackUserLogin = (user: any, additionalProperties: any = {}) => {
  trackEvent('user_login', {
    user_id: user.id,
    login_method: 'email',
    ...additionalProperties,
  });
};

// 表单提交埋点
export const trackFormSubmit = (formName: string, formData: any = {}, additionalProperties: any = {}) => {
  trackEvent('form_submit', {
    form_name: formName,
    form_data: formData,
    ...additionalProperties,
  });
};

// 按钮点击埋点
export const trackButtonClick = (buttonName: string, buttonLocation: string, additionalProperties: any = {}) => {
  trackEvent('button_click', {
    button_name: buttonName,
    button_location: buttonLocation,
    ...additionalProperties,
  });
};

// 链接点击埋点
export const trackLinkClick = (linkText: string, linkUrl: string, linkLocation: string, additionalProperties: any = {}) => {
  trackEvent('link_click', {
    link_text: linkText,
    link_url: linkUrl,
    link_location: linkLocation,
    ...additionalProperties,
  });
};

// 错误埋点
export const trackError = (errorMessage: string, errorType: string = 'javascript', additionalProperties: any = {}) => {
  trackEvent('error', {
    error_message: errorMessage,
    error_type: errorType,
    ...additionalProperties,
  });
};

// 性能埋点
export const trackPerformance = (metricName: string, value: number, additionalProperties: any = {}) => {
  trackEvent('performance', {
    metric_name: metricName,
    metric_value: value,
    ...additionalProperties,
  });
};
