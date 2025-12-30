/**
 * Probe-X Web SDK TypeScript 类型定义
 */

// 基础配置接口
export interface ProbeXConfig {
  // 基础配置
  apiUrl?: string;
  appId?: string;
  debug?: boolean;
  
  // 自动埋点配置
  autoTrack?: boolean;
  autoTrackPageView?: boolean;
  autoTrackClick?: boolean;
  autoTrackScroll?: boolean;
  autoTrackForm?: boolean;
  autoTrackHashChange?: boolean;
  autoTrackUnload?: boolean;
  
  // 发送配置
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  sendTimeout?: number;
  
  // 存储配置
  storageType?: 'localStorage' | 'sessionStorage' | 'memory';
  maxStorageSize?: number;
  storagePrefix?: string;
  
  // 过滤配置
  blacklistUrls?: (string | RegExp)[];
  whitelistUrls?: (string | RegExp)[];
  blacklistEvents?: string[];
  whitelistEvents?: string[];
  
  // 采样配置
  sampling?: number;
  
  // 用户配置
  userProperties?: UserProperties;
  globalProperties?: GlobalProperties;
  
  // 功能开关
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  enableErrorTracking?: boolean;
  enablePerformanceTracking?: boolean;
  enableNetworkTracking?: boolean;
  enableResourceTracking?: boolean;
  enableHeatmap?: boolean;
  enableSessionReplay?: boolean;
  
  // 数据压缩
  enableCompression?: boolean;
  compressionType?: 'gzip' | 'lz4';
  
  // 隐私配置
  respectDNT?: boolean; // Do Not Track
  anonymizeIP?: boolean;
  maskSensitiveData?: boolean;
  
  // 插件配置
  plugins?: PluginConfig[];
  
  // 自定义配置
  [key: string]: any;
}

// 用户属性
export interface UserProperties {
  user_id?: string | number;
  user_name?: string;
  user_type?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  registration_date?: string;
  last_login?: string;
  [key: string]: any;
}

// 全局属性
export interface GlobalProperties {
  app_version?: string;
  environment?: string;
  platform?: string;
  channel?: string;
  [key: string]: any;
}

// 追踪选项
export interface TrackOptions {
  immediate?: boolean;
  priority?: 'low' | 'normal' | 'high';
  compress?: boolean;
  encrypt?: boolean;
  [key: string]: any;
}

// 事件接口
export interface ProbeXEvent {
  id: string;
  eventName: string;
  timestamp: number;
  logTime: string;
  page: PageInfo;
  user: UserInfo;
  device: DeviceInfo;
  properties: Record<string, any>;
  options: TrackOptions;
  session: SessionInfo;
  sdk: SDKInfo;
  performance?: PerformanceData;
  network?: NetworkInfo;
}

// 页面信息
export interface PageInfo {
  title: string;
  url: string;
  path: string;
  search: string;
  hash: string;
  referrer: string;
  viewport: ViewportInfo;
  scroll: ScrollInfo;
}

// 用户信息
export interface UserInfo extends UserProperties {
  [key: string]: any;
}

// 设备信息
export interface DeviceInfo {
  userAgent: string;
  language: string;
  languages: string[];
  platform: string;
  screen: ScreenInfo;
  viewport: ViewportInfo;
  timezone: string;
  cookieEnabled: boolean;
  onLine: boolean;
  connection?: ConnectionInfo;
  battery?: BatteryInfo;
}

// 屏幕信息
export interface ScreenInfo {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelDepth: number;
  orientation?: string;
  pixelRatio: number;
}

// 视口信息
export interface ViewportInfo {
  width: number;
  height: number;
}

// 滚动信息
export interface ScrollInfo {
  x: number;
  y: number;
  percentage: number;
}

// 会话信息
export interface SessionInfo {
  id: string;
  startTime: string;
  duration: number;
  pageViews: number;
  events: number;
}

// SDK信息
export interface SDKInfo {
  name: string;
  version: string;
  build?: string;
}

// 元素信息
export interface ElementInfo {
  type: string | null;
  id: string | null;
  className: string | null;
  text: string | null;
  href: string | null;
  src: string | null;
  alt: string | null;
  title: string | null;
  value: string | null;
  placeholder: string | null;
  name: string | null;
  tagName: string | null;
  xpath?: string;
  selector?: string;
}

// 浏览器信息
export interface BrowserInfo {
  name: string;
  version: string;
  userAgent: string;
  engine: string;
  engineVersion: string;
}

// 操作系统信息
export interface OSInfo {
  name: string;
  version: string;
  architecture?: string;
}

// 网络连接信息
export interface ConnectionInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

// 电池信息
export interface BatteryInfo {
  charging: boolean;
  level: number;
  chargingTime: number;
  dischargingTime: number;
}

// 性能数据
export interface PerformanceData {
  navigation?: NavigationTiming;
  paint?: PaintTiming[];
  resources?: ResourceTiming[];
  memory?: MemoryInfo;
  vitals?: WebVitals;
}

// 导航时间
export interface NavigationTiming {
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstByte: number;
  domInteractive: number;
  domComplete: number;
}

// 绘制时间
export interface PaintTiming {
  name: string;
  startTime: number;
}

// 资源时间
export interface ResourceTiming {
  name: string;
  startTime: number;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

// 内存信息
export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// Web Vitals
export interface WebVitals {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
}

// 网络信息
export interface NetworkInfo {
  requests: NetworkRequest[];
  errors: NetworkError[];
}

// 网络请求
export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  timestamp: number;
}

// 网络错误
export interface NetworkError {
  url: string;
  method: string;
  error: string;
  timestamp: number;
}

// 表单字段
export interface FormField {
  name: string;
  value: any;
  type: string;
}

// 验证结果
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// 热力图数据
export interface HeatmapData {
  x: number;
  y: number;
  type: 'click' | 'move' | 'scroll';
  timestamp: number;
  element?: ElementInfo;
}

// 会话重放数据
export interface SessionReplayData {
  type: 'dom' | 'event' | 'mutation';
  timestamp: number;
  data: any;
}

// 插件配置
export interface PluginConfig {
  name: string;
  plugin: Plugin;
  options?: any;
}

// 插件接口
export interface Plugin {
  name: string;
  version?: string;
  install: (probeX: any, options?: any) => void;
  uninstall?: () => void;
}

// 存储接口
export interface Storage {
  add(item: any): void;
  get(key: string): any;
  getAll(): any[];
  remove(key: string): void;
  clear(): void;
  size(): number;
}

// 事件钩子
export interface EventHooks {
  beforeTrack?: (data: { eventName: string; properties: any; options: any }) => boolean | void;
  afterTrack?: (data: { event: ProbeXEvent; eventName: string; properties: any; options: any }) => void;
  beforeSend?: (events: ProbeXEvent[]) => ProbeXEvent[] | void;
  afterSend?: (events: ProbeXEvent[], success: boolean) => void;
  userSet?: (data: { userProperties: UserProperties }) => void;
  globalPropertiesSet?: (data: { globalProperties: GlobalProperties }) => void;
  error?: (error: Error) => void;
}

// A/B测试配置
export interface ABTestConfig {
  experimentId: string;
  variantId: string;
  trafficAllocation: number;
}

// 地理位置信息
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

// 导出主要类的类型声明
export declare class ProbeX {
  constructor(options?: ProbeXConfig);
  
  // 基础方法
  init(): void;
  track(eventName: string, properties?: Record<string, any>, options?: TrackOptions): void;
  setUser(userProperties: UserProperties): void;
  setGlobalProperties(globalProperties: GlobalProperties): void;
  setConfig(key: string, value: any): void;
  getConfig(key: string, defaultValue?: any): any;
  use(plugin: Plugin, options?: any): void;
  flush(): Promise<void>;
  destroy(): void;
  
  // 信息获取方法
  getUserAgent(): string;
  getPageInfo(): PageInfo;
  getScreenInfo(): ScreenInfo;
  getBrowserInfo(): BrowserInfo;
  getSession(): { id: string; startTime: number; duration: number };
  getPerformanceData(): PerformanceData;
}

export declare class ConfigManager {
  constructor(options?: ProbeXConfig);
  get(key: string, defaultValue?: any): any;
  set(key: string, value: any): void;
  getAll(): ProbeXConfig;
  update(newConfig: Partial<ProbeXConfig>): void;
  reset(): void;
  validate(): ValidationResult;
}

export declare class EventCollector {
  constructor(config: ConfigManager);
  collectEvent(eventName: string, properties?: Record<string, any>, options?: TrackOptions): ProbeXEvent | null;
  getAllEvents(): ProbeXEvent[];
  clearEvents(): void;
  getEventCount(): number;
}

export declare class DataSender {
  constructor(config: ConfigManager);
  send(event: ProbeXEvent): void;
  flush(): Promise<void>;
  getQueueLength(): number;
  clearQueue(): void;
  destroy(): void;
}

export declare class AutoTracker {
  constructor(config: ConfigManager, collector: EventCollector);
  start(): void;
  stop(): void;
}

export declare class Utils {
  static generateUUID(): string;
  static debounce<T extends (...args: any[]) => any>(func: T, wait: number, immediate?: boolean): T;
  static throttle<T extends (...args: any[]) => any>(func: T, limit: number): T;
  static deepClone<T>(obj: T): T;
  static getUrlParameter(name: string, url?: string): string | null;
  static getAllUrlParameters(url?: string): Record<string, string>;
  static isMobile(): boolean;
  static isIOS(): boolean;
  static isAndroid(): boolean;
  static getBrowserInfo(): BrowserInfo;
  static getOSInfo(): OSInfo;
  static formatDate(date: Date | number, format?: string): string;
  static getTimestamp(): number;
  static getISOString(): string;
  static isEmpty(obj: any): boolean;
  static safeGet(obj: any, path: string, defaultValue?: any): any;
  static randomString(length?: number, chars?: string): string;
  static isValidUrl(url: string): boolean;
  static isValidEmail(email: string): boolean;
  static isValidPhone(phone: string): boolean;
  static compress(str: string): string;
  static escapeHtml(str: string): string;
  static unescapeHtml(str: string): string;
}
