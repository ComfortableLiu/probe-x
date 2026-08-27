/**
 * Probe-X Web SDK
 * 埋点数据收集SDK
 */

import { ConfigManager } from './config'
import { EventCollector } from './collector'
import { DataSender } from './sender'
import { AutoTracker } from './auto-tracker'
import { Utils } from './utils'
import { PluginManager } from './plugin-manager'
import { SessionManager } from './session-manager'
import { PerformanceMonitor } from './performance-monitor'
import type { GlobalProperties, ProbeXConfig, TrackOptions, UserProperties } from './types'

class ProbeX {
  private config: ConfigManager
  private collector: EventCollector
  private sender: DataSender
  private autoTracker: AutoTracker
  private pluginManager: PluginManager
  private sessionManager: SessionManager
  private performanceMonitor: PerformanceMonitor
  private utils: Utils

  private isInitialized: boolean = false
  private startTime: number
  private visibilityHiddenTime: number = 0

  // 转发自动埋点事件到发送器（auto-tracker 通过 CustomEvent 抛出事件）
  private handleAutoTrackEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail) {
      this.sender.send(detail)
    }
  }

  // 页面卸载处理（仅监听 pagehide，避免 beforeunload + pagehide 双触发导致事件重复）
  private handlePageUnload = () => {
    // 发送页面停留时间
    const stayTime = Date.now() - this.startTime
    this.track('page_stay', {
      stay_time: stayTime,
      page_url: window.location.href,
      page_path: window.location.pathname,
    })

    // 使用同步发送（优先使用 sendBeacon，适合页面卸载场景）
    this.sender.flushSync()
  }

  // 页面可见性变化处理
  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.visibilityHiddenTime = Date.now()
      this.track('page_hide', {
        page_url: window.location.href,
        page_path: window.location.pathname,
      })
    } else {
      if (this.visibilityHiddenTime > 0) {
        const hiddenDuration = Date.now() - this.visibilityHiddenTime
        this.track('page_show', {
          hidden_duration: hiddenDuration,
          page_url: window.location.href,
        })
        this.visibilityHiddenTime = 0
      }
    }
  }

  constructor(options: ProbeXConfig = {}) {
    this.config = new ConfigManager(options)
    this.collector = new EventCollector(this.config)
    this.sender = new DataSender(this.config)
    this.autoTracker = new AutoTracker(this.config, this.collector)
    this.pluginManager = new PluginManager(this.config)
    this.sessionManager = new SessionManager(this.config)
    this.performanceMonitor = new PerformanceMonitor(this.config)
    this.utils = new Utils()

    this.startTime = Date.now()

    this.init()
  }

  /**
   * 初始化SDK
   */
  init(): void {
    if (this.isInitialized) {
      console.warn('ProbeX SDK already initialized')
      return
    }

    try {
      // 提前标记为已初始化，保证初始化流程中的首个埋点可以正常发送
      this.isInitialized = true

      // 初始化会话管理
      this.sessionManager.init()

      // 初始化性能监控
      if (this.config.get('enablePerformanceTracking')) {
        this.performanceMonitor.init()
      }

      // 发送页面访问事件
      this.track('page_view', {
        page_title: document.title,
        page_url: window.location.href,
        page_path: window.location.pathname,
        referrer: document.referrer,
        session_start: true,
      })

      // 注册默认监听器，把自动埋点事件转发给 DataSender
      window.addEventListener('probe-x-event', this.handleAutoTrackEvent)

      // 启动自动埋点
      if (this.config.get('autoTrack')) {
        this.autoTracker.start()
      }

      // 初始化插件
      this.pluginManager.init()

      // 页面卸载时发送数据
      this.setupBeforeUnload()

      // 页面可见性变化监听
      this.setupVisibilityChange()

      console.log('ProbeX SDK initialized successfully')
    } catch (error) {
      // 初始化失败时回滚初始化标记，避免后续误判为已就绪
      this.isInitialized = false
      console.error('ProbeX SDK initialization failed:', error)
    }
  }

  /**
   * 手动埋点
   */
  track(eventName: string, properties: Record<string, any> = {}, options: TrackOptions = {}): void {
    if (!this.isInitialized) {
      console.warn('ProbeX SDK not initialized')
      return
    }

    try {
      const event = this.collector.collectEvent(eventName, properties, options)
      if (event) {
        this.sender.send(event)

        // 触发插件钩子
        this.pluginManager.trigger('afterTrack', { event, eventName, properties, options })
      }
    } catch (error) {
      console.error('ProbeX track error:', error)
    }
  }

  /**
   * 设置用户属性
   */
  setUser(userProperties: UserProperties): void {
    this.config.set('userProperties', {
      ...this.config.get('userProperties', {}),
      ...userProperties,
    })

    // 触发插件钩子
    this.pluginManager.trigger('userSet', { userProperties })
  }

  /**
   * 设置全局属性
   */
  setGlobalProperties(globalProperties: GlobalProperties): void {
    this.config.set('globalProperties', {
      ...this.config.get('globalProperties', {}),
      ...globalProperties,
    })

    // 触发插件钩子
    this.pluginManager.trigger('globalPropertiesSet', { globalProperties })
  }

  /**
   * 设置配置
   */
  setConfig(key: string, value: any): void {
    this.config.set(key, value)
  }

  /**
   * 获取配置
   */
  getConfig(key: string, defaultValue?: any): any {
    return this.config.get(key, defaultValue)
  }

  /**
   * 注册插件
   */
  use(plugin: any, options?: any): void {
    this.pluginManager.register(plugin, options)
  }

  /**
   * 获取会话信息
   */
  getSession(): { id: string; startTime: number; duration: number } {
    return this.sessionManager.getSession()
  }

  /**
   * 获取性能数据
   */
  getPerformanceData(): any {
    return this.performanceMonitor.getPerformanceData()
  }

  /**
   * 手动刷新发送队列
   */
  flush(): Promise<void> {
    return this.sender.flush()
  }

  /**
   * 设置页面卸载监听（仅监听 pagehide，beforeunload 与 pagehide 双挂会导致事件重复）
   */
  private setupBeforeUnload(): void {
    window.addEventListener('pagehide', this.handlePageUnload)
  }

  /**
   * 设置页面可见性变化监听
   */
  private setupVisibilityChange(): void {
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  /**
   * 获取用户代理信息
   */
  getUserAgent(): string {
    return navigator.userAgent
  }

  /**
   * 获取页面信息
   */
  getPageInfo(): any {
    return {
      title: document.title,
      url: window.location.href,
      path: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      referrer: document.referrer,
    }
  }

  /**
   * 获取屏幕信息
   */
  getScreenInfo(): any {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
    }
  }

  /**
   * 获取浏览器信息
   */
  getBrowserInfo(): any {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    }
  }

  /**
   * 销毁SDK
   */
  destroy(): void {
    window.removeEventListener('probe-x-event', this.handleAutoTrackEvent)
    window.removeEventListener('pagehide', this.handlePageUnload)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)

    if (this.autoTracker) {
      this.autoTracker.stop()
    }

    if (this.sender) {
      this.sender.destroy()
    }

    if (this.sessionManager) {
      this.sessionManager.destroy()
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.destroy()
    }

    if (this.pluginManager) {
      this.pluginManager.destroy()
    }

    this.isInitialized = false
    console.log('ProbeX SDK destroyed')
  }
}

// 创建全局实例
if (typeof window !== 'undefined') {
  (window as any).ProbeX = ProbeX
}

export default ProbeX
export { ProbeX }
export * from './types'
