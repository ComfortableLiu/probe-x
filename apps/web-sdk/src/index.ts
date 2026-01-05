/**
 * Probe-X Web SDK
 * 埋点数据收集SDK
 */

import { v4 as uuidv4 } from 'uuid'
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
  private sessionId: string
  private deviceId: string
  private startTime: number

  constructor(options: ProbeXConfig = {}) {
    this.config = new ConfigManager(options)
    this.collector = new EventCollector(this.config)
    this.sender = new DataSender(this.config)
    this.autoTracker = new AutoTracker(this.config, this.collector)
    this.pluginManager = new PluginManager(this.config)
    this.sessionManager = new SessionManager(this.config)
    this.performanceMonitor = new PerformanceMonitor(this.config)
    this.utils = new Utils()

    this.sessionId = this.generateSessionId()
    this.deviceId = this.getOrCreateDeviceId()
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
   * 生成会话ID
   */
  private generateSessionId(): string {
    const now = Date.now()
    const sessionKey = 'probe_x_session_id'
    const sessionExpiry = 30 * 60 * 1000 // 30分钟

    let sessionId = localStorage.getItem(sessionKey)
    const sessionTime = localStorage.getItem(sessionKey + '_time')

    if (!sessionId || !sessionTime || (now - parseInt(sessionTime)) > sessionExpiry) {
      sessionId = uuidv4()
      localStorage.setItem(sessionKey, sessionId)
      localStorage.setItem(sessionKey + '_time', now.toString())
    }

    return sessionId
  }

  /**
   * 获取或创建设备ID
   */
  private getOrCreateDeviceId(): string {
    const deviceKey = 'probe_x_device_id'
    let deviceId = localStorage.getItem(deviceKey)

    if (!deviceId) {
      deviceId = uuidv4()
      localStorage.setItem(deviceKey, deviceId)
    }

    return deviceId
  }

  /**
   * 设置页面卸载监听
   */
  private setupBeforeUnload(): void {
    const handleBeforeUnload = () => {
      // 发送页面停留时间
      const stayTime = Date.now() - this.startTime
      this.track('page_stay', {
        stay_time: stayTime,
        page_url: window.location.href,
        page_path: window.location.pathname,
      })

      // 立即发送队列中的数据
      this.sender.flush()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
  }

  /**
   * 设置页面可见性变化监听
   */
  private setupVisibilityChange(): void {
    let hiddenTime = 0

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTime = Date.now()
      } else {
        if (hiddenTime > 0) {
          const hiddenDuration = Date.now() - hiddenTime
          this.track('page_show', {
            hidden_duration: hiddenDuration,
            page_url: window.location.href,
          })
          hiddenTime = 0
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
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
