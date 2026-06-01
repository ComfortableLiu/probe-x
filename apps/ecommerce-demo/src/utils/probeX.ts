// Probe-X SDK集成
import ProbeX from '@probe-x/web-sdk';

// 全局ProbeX实例
let probeXInstance: ProbeX | null = null;

// 初始化Probe-X SDK
export const initProbeX = () => {
  if (probeXInstance) {
    return probeXInstance;
  }

  const config = {
    apiUrl: 'http://localhost:8104/point/report',
    appId: 'ecommerce-demo',
    debug: true,
    autoTrack: true,
    autoTrackPageView: true,
    autoTrackClick: true,
    autoTrackScroll: true,
    autoTrackForm: true,
    batchSize: 10,
    flushInterval: 5000,
  };

  probeXInstance = new ProbeX(config);
  return probeXInstance;
};

// 获取ProbeX实例
export const getProbeX = (): ProbeX => {
  if (!probeXInstance) {
    return initProbeX();
  }
  return probeXInstance;
};

// 埋点事件跟踪函数
export const trackEvent = (eventName: string, properties: Record<string, any> = {}) => {
  const probeX = getProbeX();
  probeX.track(eventName, properties);
};

// 设置用户属性
export const setUserProperties = (userProperties: Record<string, any>) => {
  const probeX = getProbeX();
  probeX.setUser(userProperties);
};

// 页面访问埋点
export const trackPageView = (pageName: string, additionalProperties: Record<string, any> = {}) => {
  trackEvent('page_view', {
    page_name: pageName,
    page_url: window.location.href,
    referrer: document.referrer,
    ...additionalProperties,
  });
};

// 商品浏览埋点
export const trackProductView = (product: any, additionalProperties: Record<string, any> = {}) => {
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
export const trackProductClick = (product: any, clickType: string = 'card', additionalProperties: Record<string, any> = {}) => {
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
export const trackAddToCart = (product: any, quantity: number = 1, additionalProperties: Record<string, any> = {}) => {
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
export const trackCartAction = (action: string, product?: any, quantity?: number, additionalProperties: Record<string, any> = {}) => {
  const eventProperties: Record<string, any> = {
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
export const trackSearch = (keyword: string, resultsCount: number = 0, additionalProperties: Record<string, any> = {}) => {
  trackEvent('search', {
    keyword: keyword,
    results_count: resultsCount,
    ...additionalProperties,
  });
};

// 购买埋点
export const trackPurchase = (order: any, additionalProperties: Record<string, any> = {}) => {
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
export const trackUserRegister = (user: any, additionalProperties: Record<string, any> = {}) => {
  trackEvent('user_register', {
    user_id: user.id,
    register_method: 'email',
    ...additionalProperties,
  });
};

// 用户登录埋点
export const trackUserLogin = (user: any, additionalProperties: Record<string, any> = {}) => {
  trackEvent('user_login', {
    user_id: user.id,
    login_method: 'email',
    ...additionalProperties,
  });
};

// 表单提交埋点
export const trackFormSubmit = (formName: string, formData: Record<string, any> = {}, additionalProperties: Record<string, any> = {}) => {
  trackEvent('form_submit', {
    form_name: formName,
    form_data: formData,
    ...additionalProperties,
  });
};

// 按钮点击埋点
export const trackButtonClick = (buttonName: string, buttonLocation: string, additionalProperties: Record<string, any> = {}) => {
  trackEvent('button_click', {
    button_name: buttonName,
    button_location: buttonLocation,
    ...additionalProperties,
  });
};

// 链接点击埋点
export const trackLinkClick = (linkText: string, linkUrl: string, linkLocation: string, additionalProperties: Record<string, any> = {}) => {
  trackEvent('link_click', {
    link_text: linkText,
    link_url: linkUrl,
    link_location: linkLocation,
    ...additionalProperties,
  });
};

// 错误埋点
export const trackError = (errorMessage: string, errorType: string = 'javascript', additionalProperties: Record<string, any> = {}) => {
  trackEvent('error', {
    error_message: errorMessage,
    error_type: errorType,
    ...additionalProperties,
  });
};

// 性能埋点
export const trackPerformance = (metricName: string, value: number, additionalProperties: Record<string, any> = {}) => {
  trackEvent('performance', {
    metric_name: metricName,
    metric_value: value,
    ...additionalProperties,
  });
};
