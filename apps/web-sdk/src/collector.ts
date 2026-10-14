/**
 * 事件收集器
 */

import { v4 as uuidv4 } from 'uuid'
import type { DeviceInfo, PageInfo, ProbeXEvent, SDKInfo, SessionInfo, Storage, TrackOptions, UserInfo } from './types'
import { ConfigManager } from './config'
import { PageTracker } from './page-tracker'

export class EventCollector {
  private config: ConfigManager
  private storage: Storage
  private pageTracker: PageTracker

  constructor(config: ConfigManager) {
    this.config = config
    this.storage = this.createStorage()
    this.pageTracker = new PageTracker()
  }

  /**
   * 创建存储实例
   */
  private createStorage(): Storage {
    const storageType = this.config.get('storageType', 'localStorage') as 'localStorage' | 'sessionStorage' | 'memory'
    const maxSize = this.config.get('maxStorageSize', 1000)

    switch (storageType) {
      case 'localStorage':
        return new LocalStorage(maxSize, this.config)
      case 'sessionStorage':
        return new SessionStorage(maxSize, this.config)
      case 'memory':
        return new MemoryStorage(maxSize)
      default:
        return new MemoryStorage(maxSize)
    }
  }

  /**
   * 收集事件
   */
  collectEvent(eventName: string, properties: Record<string, any> = {}, options: TrackOptions = {}): ProbeXEvent | null {
    // 检查DNT设置
    if (this.config.shouldRespectDNT()) {
      return null
    }

    // 检查采样率
    if (!this.shouldSample()) {
      return null
    }

    // 检查事件过滤
    if (!this.shouldTrackEvent(eventName)) {
      return null
    }

    // 检查URL过滤
    if (!this.shouldTrackUrl()) {
      return null
    }

    const now = Date.now()
    const eventProperties: Record<string, any> = {
      ...this.config.get('globalProperties', {}),
      ...this.maskSensitiveData(properties),
    }

    // 注入页面追踪与归因字段（$page_id/$source_page_id/$is_attribution_event 等）
    this.applyPageTracking(eventName, eventProperties)

    const event: ProbeXEvent = {
      // 基础信息
      id: uuidv4(),
      eventName,
      timestamp: now,
      logTime: new Date(now).toISOString(),

      // 页面信息
      page: this.getPageInfo(),

      // 用户信息
      user: this.getUserInfo(),

      // 设备信息
      device: this.getDeviceInfo(),

      // 事件属性
      properties: eventProperties,

      // 选项
      options: {
        ...options,
      },

      // 会话信息
      session: this.getSessionInfo(),

      // SDK信息
      sdk: this.getSDKInfo(),
    }

    // 添加性能数据
    if (this.config.isFeatureEnabled('performance')) {
      event.performance = this.getPerformanceData()
    }

    // 存储事件
    this.storage.add(event)

    return event
  }

  /**
   * 获取页面信息
   */
  private getPageInfo(): PageInfo {
    return {
      title: document.title,
      url: window.location.href,
      path: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      referrer: document.referrer,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scroll: {
        x: window.pageXOffset || document.documentElement.scrollLeft,
        y: window.pageYOffset || document.documentElement.scrollTop,
        percentage: this.getScrollPercentage(),
      },
    }
  }

  /**
   * 获取用户信息
   */
  private getUserInfo(): UserInfo {
    return {
      ...this.config.get('userProperties', {}),
    }
  }

  /**
   * 获取设备信息
   */
  private getDeviceInfo(): DeviceInfo {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    const battery = (navigator as any).battery || (navigator as any).getBattery?.()

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: Array.from(navigator.languages || [navigator.language]),
      platform: navigator.platform,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        orientation: (screen as any).orientation?.type,
        pixelRatio: window.devicePixelRatio || 1,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      connection: connection ? {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      } : undefined,
      battery: battery ? {
        charging: battery.charging,
        level: battery.level,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      } : undefined,
    }
  }

  /**
   * 获取会话信息
   */
  private getSessionInfo(): SessionInfo {
    const sessionId = this.getSessionId()
    const sessionStartTime = this.getSessionStartTime()
    const now = Date.now()

    return {
      id: sessionId,
      startTime: new Date(parseInt(sessionStartTime)).toISOString(),
      duration: now - parseInt(sessionStartTime),
      pageViews: this.getSessionPageViews(),
      events: this.getSessionEventCount(),
    }
  }

  /**
   * 获取SDK信息
   */
  private getSDKInfo(): SDKInfo {
    return {
      name: 'probe-x-web-sdk',
      version: '2.0.0',
      build: (typeof process !== 'undefined' && process.env && process.env.BUILD_VERSION) || 'dev',
    }
  }

  /**
   * 获取性能数据
   */
  private getPerformanceData(): any {
    if (!window.performance) {
      return null
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const paint = performance.getEntriesByType('paint')
    const memory = (performance as any).memory

    return {
      navigation: navigation ? {
        navigationStart: navigation.fetchStart || 0,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        loadComplete: navigation.loadEventEnd - navigation.fetchStart,
        firstByte: navigation.responseStart - navigation.fetchStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        domComplete: navigation.domComplete - navigation.fetchStart,
      } : null,
      paint: paint.map(p => ({
        name: p.name,
        startTime: p.startTime,
      })),
      memory: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : null,
    }
  }

  /**
   * 获取会话ID
   */
  private getSessionId(): string {
    const sessionKey = this.config.getStorageKey('session_id')

    try {
      return localStorage.getItem(sessionKey) || uuidv4()
    } catch {
      // localStorage 不可用（隐私模式/SSR），回退到内存
      return uuidv4()
    }
  }

  /**
   * 获取会话开始时间
   */
  private getSessionStartTime(): string {
    // 与 SessionManager 写入的 key 保持一致（session_start_time 为会话开始时间，session_time 是最后活动时间）
    const sessionStartKey = this.config.getStorageKey('session_start_time')

    try {
      return localStorage.getItem(sessionStartKey) || Date.now().toString()
    } catch {
      // localStorage 不可用
      return Date.now().toString()
    }
  }

  /**
   * 获取会话页面访问数
   */
  private getSessionPageViews(): number {
    const key = this.config.getStorageKey('session_page_views')

    try {
      const count = parseInt(localStorage.getItem(key) || '0')
      return count
    } catch {
      // localStorage 不可用
      return 0
    }
  }

  /**
   * 获取会话事件数
   */
  private getSessionEventCount(): number {
    // 与 SessionManager 写入的 key 保持一致（session_events）
    const key = this.config.getStorageKey('session_events')

    try {
      const count = parseInt(localStorage.getItem(key) || '0')
      return count + 1 // 包含当前事件
    } catch {
      // localStorage 不可用
      return 1 // 仅包含当前事件
    }
  }

  /**
   * 获取滚动百分比
   */
  private getScrollPercentage(): number {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight

    if (documentHeight === 0) return 0

    return Math.round((scrollTop / documentHeight) * 100)
  }

  /**
   * 检查是否应该采样
   */
  private shouldSample(): boolean {
    const sampling = this.config.get('sampling', 1.0)
    return Math.random() < sampling
  }

  /**
   * 检查是否应该跟踪事件
   */
  private shouldTrackEvent(eventName: string): boolean {
    const blacklist = this.config.get('blacklistEvents', []) as string[]
    const whitelist = this.config.get('whitelistEvents', []) as string[]

    // 如果在黑名单中，不跟踪
    if (blacklist.includes(eventName)) {
      return false
    }

    // 如果白名单不为空且不在白名单中，不跟踪
    if (whitelist.length > 0 && !whitelist.includes(eventName)) {
      return false
    }

    return true
  }

  /**
   * 检查是否应该跟踪URL
   */
  private shouldTrackUrl(): boolean {
    const currentUrl = window.location.href
    const blacklist = this.config.get('blacklistUrls', [])
    const whitelist = this.config.get('whitelistUrls', [])

    // 如果在黑名单中，不跟踪
    for (const pattern of blacklist) {
      if (this.matchUrl(currentUrl, pattern)) {
        return false
      }
    }

    // 如果白名单不为空且不在白名单中，不跟踪
    if (whitelist.length > 0) {
      for (const pattern of whitelist) {
        if (this.matchUrl(currentUrl, pattern)) {
          return true
        }
      }
      return false
    }

    return true
  }

  /**
   * URL匹配
   */
  private matchUrl(url: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(url)
    }
    if (typeof pattern === 'string') {
      return url.includes(pattern)
    }
    return false
  }

  /**
   * 注入页面追踪与归因字段
   * - page_view 事件先轮换页面浏览 id（每次页面浏览生成一个新 $page_id）
   * - 每个事件（不只是 page_view）都携带当前 $page_id 与 $source_page_id；
   *   业务显式传入同名字段时不覆盖，以业务为准
   * - page_view 且携带非空 $spm/$scm 时标记为归因事件：
   *   $is_attribution_event = true，$target_page_id = 本次 $page_id；
   *   其他事件不加 $is_attribution_event（服务端列默认 false）
   * - $ex_attribution_params 序列化为 JSON 字符串（服务端列为 String），非法/空值不出字段
   *
   * 在 maskSensitiveData 之后执行：这些 key 不含敏感词不会被脱敏，
   * 但后注入可以保证注入值一定是原始值
   */
  private applyPageTracking(eventName: string, properties: Record<string, any>): void {
    if (eventName === 'page_view') {
      this.pageTracker.rotate()
    }

    if (properties.$page_id === undefined) {
      properties.$page_id = this.pageTracker.getPageId()
    }
    if (properties.$source_page_id === undefined) {
      properties.$source_page_id = this.pageTracker.getSourcePageId()
    }

    if (eventName === 'page_view' && (this.hasText(properties.$spm) || this.hasText(properties.$scm))) {
      if (properties.$is_attribution_event === undefined) {
        properties.$is_attribution_event = true
      }
      if (properties.$target_page_id === undefined) {
        properties.$target_page_id = properties.$page_id
      }
    }

    this.serializeAttributionParams(properties)
  }

  /**
   * 判断点位值是否非空（空串/纯空白串/null/undefined 视为空）
   */
  private hasText(value: any): boolean {
    if (typeof value === 'string') {
      return value.trim().length > 0
    }
    return value !== undefined && value !== null
  }

  /**
   * 序列化 $ex_attribution_params：业务传对象，发送前统一转成 JSON 字符串；
   * 已是字符串的原样透传；空值/非法值（无法序列化、空对象、非对象原始类型）移除该字段
   */
  private serializeAttributionParams(properties: Record<string, any>): void {
    if (!('$ex_attribution_params' in properties)) {
      return
    }

    const value = properties.$ex_attribution_params

    if (value === undefined || value === null || value === '') {
      delete properties.$ex_attribution_params
      return
    }

    if (typeof value === 'string') {
      return
    }

    if (typeof value === 'object') {
      try {
        const serialized = JSON.stringify(value)
        // 空对象/空数组序列化后没有归因信息，视为空值不上报
        if (!serialized || serialized === '{}' || serialized === '[]') {
          delete properties.$ex_attribution_params
          return
        }
        properties.$ex_attribution_params = serialized
      } catch {
        // 循环引用等无法序列化的值不上报
        delete properties.$ex_attribution_params
      }
      return
    }

    // number/boolean 等其他原始类型不是合法的归因参数
    delete properties.$ex_attribution_params
  }

  /**
   * 脱敏敏感数据
   */
  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    if (!this.config.get('maskSensitiveData', true)) {
      return data
    }

    const sensitiveKeys = ['password', 'pwd', 'token', 'secret', 'key', 'auth', 'credit', 'card', 'ssn', 'phone', 'email']
    const masked = { ...data }

    Object.keys(masked).forEach(key => {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        if (typeof masked[key] === 'string') {
          masked[key] = '***'
        }
      }
    })

    return masked
  }

  /**
   * 获取所有事件
   */
  getAllEvents(): ProbeXEvent[] {
    return this.storage.getAll()
  }

  /**
   * 清空事件
   */
  clearEvents(): void {
    this.storage.clear()
  }

  /**
   * 获取事件数量
   */
  getEventCount(): number {
    return this.storage.size()
  }
}

/**
 * 本地存储
 */
class LocalStorage implements Storage {
  private maxSize: number
  private key: string

  constructor(maxSize: number, config: ConfigManager) {
    this.maxSize = maxSize
    this.key = config.getStorageKey('events')
  }

  add(event: ProbeXEvent): void {
    const events = this.getAll()
    events.push(event)

    if (events.length > this.maxSize) {
      events.splice(0, events.length - this.maxSize)
    }

    try {
      localStorage.setItem(this.key, JSON.stringify(events))
    } catch (error) {
      console.error('LocalStorage error:', error)
    }
  }

  get(key: string): any {
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('LocalStorage error:', error)
      return null
    }
  }

  getAll(): ProbeXEvent[] {
    try {
      const data = localStorage.getItem(this.key)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('LocalStorage error:', error)
      return []
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('LocalStorage error:', error)
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key)
    } catch (error) {
      console.error('LocalStorage error:', error)
    }
  }

  size(): number {
    return this.getAll().length
  }
}

/**
 * 会话存储
 */
class SessionStorage implements Storage {
  private maxSize: number
  private key: string

  constructor(maxSize: number, config: ConfigManager) {
    this.maxSize = maxSize
    this.key = config.getStorageKey('events')
  }

  add(event: ProbeXEvent): void {
    const events = this.getAll()
    events.push(event)

    if (events.length > this.maxSize) {
      events.splice(0, events.length - this.maxSize)
    }

    try {
      sessionStorage.setItem(this.key, JSON.stringify(events))
    } catch (error) {
      console.error('SessionStorage error:', error)
    }
  }

  get(key: string): any {
    try {
      const data = sessionStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('SessionStorage error:', error)
      return null
    }
  }

  getAll(): ProbeXEvent[] {
    try {
      const data = sessionStorage.getItem(this.key)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('SessionStorage error:', error)
      return []
    }
  }

  remove(key: string): void {
    try {
      sessionStorage.removeItem(key)
    } catch (error) {
      console.error('SessionStorage error:', error)
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(this.key)
    } catch (error) {
      console.error('SessionStorage error:', error)
    }
  }

  size(): number {
    return this.getAll().length
  }
}

/**
 * 内存存储
 */
class MemoryStorage implements Storage {
  private maxSize: number
  private events: ProbeXEvent[] = []
  private data: Map<string, any> = new Map()

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  add(event: ProbeXEvent): void {
    this.events.push(event)

    if (this.events.length > this.maxSize) {
      this.events.splice(0, this.events.length - this.maxSize)
    }
  }

  get(key: string): any {
    return this.data.get(key)
  }

  getAll(): ProbeXEvent[] {
    return [...this.events]
  }

  remove(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.events = []
    this.data.clear()
  }

  size(): number {
    return this.events.length
  }
}
