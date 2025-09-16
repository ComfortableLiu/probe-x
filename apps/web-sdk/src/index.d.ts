/**
 * Probe-X Web SDK TypeScript 类型定义
 */

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
  
  // 发送配置
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  
  // 存储配置
  storageType?: 'localStorage' | 'sessionStorage' | 'memory';
  maxStorageSize?: number;
  
  // 过滤配置
  blacklistUrls?: (string | RegExp)[];
  whitelistUrls?: (string | RegExp)[];
  blacklistEvents?: string[];
  whitelistEvents?: string[];
  
  // 采样配置
  sampling?: number;
  
  // 用户配置
  userProperties?: Record<string, any>;
  globalProperties?: Record<string, any>;
  
  // 其他配置
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  enableErrorTracking?: boolean;
  enablePerformanceTracking?: boolean;
}

export interface ProbeXEvent {
  id: string;
  eventName: string;
  timestamp: number;
  logTime: string;
  page: PageInfo;
  user: UserInfo;
  device: DeviceInfo;
  properties: Record<string, any>;
  options: Record<string, any>;
  session: SessionInfo;
  sdk: SDKInfo;
}

export interface PageInfo {
  title: string;
  url: string;
  path: string;
  search: string;
  hash: string;
  referrer: string;
}

export interface UserInfo {
  [key: string]: any;
}

export interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  screen: ScreenInfo;
  viewport: ViewportInfo;
}

export interface ScreenInfo {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelDepth: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
}

export interface SessionInfo {
  id: string;
  startTime: string;
}

export interface SDKInfo {
  name: string;
  version: string;
}

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
}

export interface BrowserInfo {
  name: string;
  version: string;
  userAgent: string;
}

export interface OSInfo {
  name: string;
  version: string;
}

export interface PerformanceData {
  navigation_start: number | null;
  dom_content_loaded: number | null;
  load_complete: number | null;
  first_paint: number | null;
  first_contentful_paint: number | null;
  connection_type: string | null;
  connection_downlink: number | null;
  connection_rtt: number | null;
}

export interface FormField {
  name: string;
  value: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export declare class ProbeX {
  constructor(options?: ProbeXConfig);
  
  // 基础方法
  init(): void;
  track(eventName: string, properties?: Record<string, any>, options?: Record<string, any>): void;
  setUser(userProperties: Record<string, any>): void;
  setGlobalProperties(globalProperties: Record<string, any>): void;
  setConfig(key: string, value: any): void;
  getConfig(key: string, defaultValue?: any): any;
  destroy(): void;
  
  // 信息获取方法
  getUserAgent(): string;
  getPageInfo(): PageInfo;
  getScreenInfo(): ScreenInfo;
  getBrowserInfo(): BrowserInfo;
  
  // 内部方法
  generateSessionId(): string;
  getOrCreateDeviceId(): string;
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
  collectEvent(eventName: string, properties?: Record<string, any>, options?: Record<string, any>): ProbeXEvent | null;
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

export default ProbeX;
