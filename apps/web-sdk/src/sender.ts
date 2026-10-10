/**
 * 数据发送器
 */
import { v4 as uuidv4 } from 'uuid'
import type { ProbeXEvent } from './types'
import { ConfigManager } from './config'

export class DataSender {
  private config: ConfigManager
  private queue: ProbeXEvent[] = []
  private isSending: boolean = false
  private retryCount: number = 0
  private maxRetries: number
  private retryDelay: number
  private batchSize: number
  private flushInterval: number
  private sendTimeout: number
  private timer?: number
  private retryTimer?: number

  constructor(config: ConfigManager) {
    this.config = config
    this.maxRetries = this.config.get('maxRetries', 3)
    this.retryDelay = this.config.get('retryDelay', 1000)
    this.batchSize = this.config.get('batchSize', 10)
    this.flushInterval = this.config.get('flushInterval', 5000)
    this.sendTimeout = this.config.get('sendTimeout', 10000)

    this.startFlushTimer()
  }

  /**
   * 发送事件
   */
  send(event: ProbeXEvent): void {
    if (!event) return

    this.queue.push(event)

    // 如果队列达到批量大小或者是高优先级事件，立即发送
    if (this.queue.length >= this.batchSize || event.options.priority === 'high') {
      this.flush()
    }
  }

  /**
   * 批量发送
   */
  async flush(): Promise<void> {
    if (this.isSending || this.queue.length === 0) {
      return
    }

    this.isSending = true
    const events = this.queue.splice(0, this.batchSize)

    try {
      await this.sendBatch(events)
      this.retryCount = 0

      if (this.config.get('debug')) {
        console.log('ProbeX: Events sent successfully', events)
      }
    } catch (error) {
      console.error('ProbeX send error:', error)

      // 重试逻辑
      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        this.retryTimer = window.setTimeout(() => {
          this.retryTimer = undefined
          this.queue.unshift(...events) // 重新加入队列
          this.isSending = false
          this.flush()
        }, this.retryDelay * this.retryCount)
        return
      } else {
        // 重试失败，记录错误
        console.error('ProbeX: Max retries exceeded, events lost:', events)
        this.retryCount = 0
      }
    }

    this.isSending = false
  }

  /**
   * 同步批量发送（用于页面卸载场景）
   * transport 为 'gif' 时跳过 beacon 直接走 gif 分支；其余情况优先使用 sendBeacon
   */
  flushSync(): void {
    if (this.queue.length === 0) {
      return
    }

    const events = this.queue.splice(0, this.batchSize)
    const apiUrl = this.config.get('apiUrl')
    const appId = this.config.get('appId')

    if (!apiUrl || !appId) {
      return
    }

    // 准备发送数据
    const payload = {
      appId,
      events: events.map(event => this.prepareEvent(event)),
      timestamp: Date.now(),
      batchId: this.generateBatchId(),
      sdk: {
        name: 'probe-x-web-sdk',
        version: '2.0.0',
      },
    }

    const transport = this.config.get<'beacon' | 'fetch' | 'gif'>('transport', 'beacon')
    const allowFallback = this.config.get<boolean>('allowFallback', true)
    let beaconTried = false

    // 优先使用 sendBeacon（同步，不阻塞页面卸载）
    // transport 为 'gif' 时跳过 beacon 直接走 gif 分支；
    // transport 为 'fetch' 时卸载场景仍使用 beacon：fetch 是异步的，页面卸载时不保证发出和完成，
    // sendBeacon 是卸载场景下唯一可靠的同步上报通道
    if (transport !== 'gif' && this.canUseBeacon()) {
      beaconTried = true
      try {
        // 使用 Blob 设置正确的 Content-Type
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
        const success = navigator.sendBeacon(apiUrl, blob)
        if (success) {
          if (this.config.get('debug')) {
            console.log('ProbeX: Events sent via sendBeacon', events)
          }
          return
        }
      } catch (error) {
        if (this.config.get('debug')) {
          console.warn('ProbeX: sendBeacon failed, trying gif fallback', error)
        }
      }
      // beacon 失败且不允许降级时，不再尝试其他方式
      if (!allowFallback) {
        return
      }
    }

    // sendBeacon 不可用或失败（或 transport 配置为 'gif'），使用 gif 图片请求（同步）
    try {
      const gifUrl = apiUrl.replace(/\/report$/, '/track.gif')
      const result = this.buildGifUrl(apiUrl, payload)

      if (!result.tooLong) {
        new Image().src = result.url
        return
      }

      if (allowFallback) {
        // 压缩后仍超长：beacon 尚未尝试时改用 beacon 完整上报；卸载场景 fetch 不可靠，不作为降级目标
        if (!beaconTried && this.sendViaBeacon(apiUrl, payload)) {
          if (this.config.get('debug')) {
            console.log('ProbeX: gif url too long, events sent via sendBeacon fallback', events)
          }
          return
        }
        console.error('ProbeX: gif url too long and no fallback transport available, events lost:', events)
        return
      }

      // 不允许降级：保持原有行为，只发送关键数据
      const minimalData = {
        appId: payload.appId,
        batchId: payload.batchId,
        timestamp: payload.timestamp,
        eventCount: payload.events?.length || 0,
      }
      const minimalParams = new URLSearchParams()
      minimalParams.append('data', JSON.stringify(minimalData))
      new Image().src = `${gifUrl}?${minimalParams.toString()}`
    } catch (error) {
      if (this.config.get('debug')) {
        console.error('ProbeX: gif fallback failed', error)
      }
    }
  }

  /**
   * 发送批量数据
   */
  private async sendBatch(events: ProbeXEvent[]): Promise<void> {
    const apiUrl = this.config.get('apiUrl')
    const appId = this.config.get('appId')
    const debug = this.config.get('debug', false)

    if (!apiUrl) {
      throw new Error('API URL not configured')
    }

    if (!appId) {
      throw new Error('App ID not configured')
    }

    // 准备发送数据
    const payload = {
      appId,
      events: events.map(event => this.prepareEvent(event)),
      timestamp: Date.now(),
      batchId: this.generateBatchId(),
      sdk: {
        name: 'probe-x-web-sdk',
        version: '2.0.0',
      },
    }

    if (debug) {
      console.log('ProbeX sending data:', payload)
    }

    // 按 transport 配置分发上报方式，默认 beacon
    const transport = this.config.get<'beacon' | 'fetch' | 'gif'>('transport', 'beacon')
    // 是否允许跨方式自动降级：gif/beacon 失败时降级使用对方方式，再次失败降级到 fetch 链
    const allowFallback = this.config.get<boolean>('allowFallback', true)

    // gif：优先 gif 图片请求；失败（含 URL 超长）且允许降级时，依次降级 beacon → fetch 链
    if (transport === 'gif') {
      try {
        await this.gifRequest(apiUrl, payload)
        if (debug) {
          console.log('ProbeX data sent successfully via gif')
        }
        return
      } catch (error) {
        if (!allowFallback) {
          throw error
        }
        if (debug) {
          console.warn('ProbeX: gif request failed, falling back to sendBeacon', error)
        }
      }
      if (this.sendViaBeacon(apiUrl, payload)) {
        if (debug) {
          console.log('ProbeX data sent successfully via sendBeacon (gif fallback)')
        }
        return
      }
      if (debug) {
        console.warn('ProbeX: sendBeacon unavailable or rejected, falling back to fetch chain')
      }
    }

    // beacon（默认）：优先 sendBeacon，返回 true 即视为成功（fire-and-forget，无响应可校验，不适用重试）；
    // sendBeacon 不可用、返回 false 或抛异常时，允许降级则先降级 gif，再降级到 fetch 链
    if (transport === 'beacon') {
      if (this.sendViaBeacon(apiUrl, payload)) {
        if (debug) {
          console.log('ProbeX data sent successfully via sendBeacon')
        }
        return
      }
      if (!allowFallback) {
        throw new Error('sendBeacon unavailable or rejected, fallback disabled')
      }
      if (debug) {
        console.warn('ProbeX: sendBeacon unavailable or rejected, falling back to gif')
      }
      try {
        await this.gifRequest(apiUrl, payload)
        if (debug) {
          console.log('ProbeX data sent successfully via gif (beacon fallback)')
        }
        return
      } catch (error) {
        if (debug) {
          console.warn('ProbeX: gif fallback failed, falling back to fetch chain', error)
        }
      }
    }

    // fetch（含 gif/beacon 降级）：走现有 fetch → XMLHttpRequest → gif 降级链
    const response = await this.makeRequest(apiUrl, payload)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    if (debug) {
      console.log('ProbeX data sent successfully')
    }
  }

  /**
   * 准备事件数据
   */
  private prepareEvent(event: ProbeXEvent): any {
    // $event_id 是端到端幂等去重键：复用 collector 生成的 uuid；
    // 缺失时补一个并写回事件，保证同一事件重试/重发时 $event_id 不变
    if (!event.id) {
      event.id = uuidv4()
    }

    return {
      $event_id: event.id,
      eventName: event.eventName,
      ip: this.getClientIP(),
      ua: event.device.userAgent,
      webSite: window.location.hostname,
      webPathname: event.page.path,
      // webParams 是公共参数「页面参数」（$web_params 列COMMENT：页面参数），只承载事件发生时页面 URL 的 query 部分；
      // 业务指标一律走 data（event.properties，接收端会展开成业务字段），严禁占用公共参数上报
      webParams: (event.page.search || '').replace(/^\?/, ''),
      deviceId: this.getDeviceId(),
      referrer: event.page.referrer,
      utmSource: this.getUTMParameter('utm_source'),
      utmMedium: this.getUTMParameter('utm_medium'),
      utmCampaign: this.getUTMParameter('utm_campaign'),
      utmTerm: this.getUTMParameter('utm_term'),
      utmContent: this.getUTMParameter('utm_content'),
      logTime: event.logTime,
      serviceTime: new Date().toISOString(),
      screenWidth: event.device.screen.width,
      screenHeight: event.device.screen.height,
      pixelRatio: event.device.screen.pixelRatio,
      device: this.getDeviceType(),
      elementId: event.properties.element_id || '',
      uid: event.user.user_id || -1,
      language: event.device.language,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: event.device.viewport.height,
      viewportWidth: event.device.viewport.width,
      // 字段名为 zoon 是与后端约定一致（receiving-point-service 解析 data.zoon），非笔误，勿改为 zoom
      zoon: event.device.screen.pixelRatio,
      data: event.properties,
      rawData: event,
      source: 'web-sdk',
    }
  }

  /**
   * 发送HTTP请求（fetch 降级链）
   * 按优先级：fetch → XMLHttpRequest → gif图片请求
   * transport 配置为 'fetch'，或 gif/beacon 降级链走到最后一环时进入本方法
   */
  private async makeRequest(url: string, data: any): Promise<Response> {
    // 1. 优先使用 fetch
    if (typeof fetch !== 'undefined') {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.sendTimeout)

        const options: RequestInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        }

        const response = await fetch(url, options)
        clearTimeout(timeoutId)
        return response
      } catch (error) {
        // fetch 失败，继续尝试其他方式
        if (this.config.get('debug')) {
          console.warn('ProbeX: fetch failed, trying fallback methods', error)
        }
      }
    }

    // 2. 降级到 XMLHttpRequest
    try {
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
      return await this.xhrRequest(url, options)
    } catch (error) {
      // XMLHttpRequest 失败，继续尝试 gif 图片请求
      if (this.config.get('debug')) {
        console.warn('ProbeX: XMLHttpRequest failed, trying gif fallback', error)
      }
    }

    // 3. 最后降级到 gif 图片请求
    return await this.gifRequest(url, data)
  }

  /**
   * XMLHttpRequest请求
   */
  private xhrRequest(url: string, options: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.open(options.method || 'GET', url, true)

      // 设置请求头
      if (options.headers) {
        Object.entries(options.headers as Record<string, string>).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value)
        })
      }

      xhr.timeout = this.sendTimeout

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            statusText: xhr.statusText,
            text: () => Promise.resolve(xhr.responseText),
            json: () => Promise.resolve(JSON.parse(xhr.responseText)),
          } as Response)
        }
      }

      xhr.onerror = () => {
        reject(new Error('Network error'))
      }

      xhr.ontimeout = () => {
        reject(new Error('Request timeout'))
      }

      xhr.send(options.body as string)
    })
  }

  /**
   * 通过 sendBeacon 发送数据（fire-and-forget）
   * 返回 true 表示浏览器已接收入队；sendBeacon 不可用、返回 false 或抛异常时返回 false，由调用方降级
   */
  private sendViaBeacon(url: string, data: any): boolean {
    if (!this.canUseBeacon()) {
      return false
    }

    try {
      // 使用 Blob 设置正确的 Content-Type
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      return navigator.sendBeacon(url, blob)
    } catch (error) {
      if (this.config.get('debug')) {
        console.warn('ProbeX: sendBeacon threw error', error)
      }
      return false
    }
  }

  /**
   * 检查是否可以使用Beacon API
   */
  private canUseBeacon(): boolean {
    return typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
  }

  /**
   * 构建 gif 上报 URL（含压缩与长度判断）
   * tooLong 为 true 表示压缩后仍超过 URL 长度限制（约 2000 字符）
   */
  private buildGifUrl(url: string, data: any): { url: string; tooLong: boolean } {
    // 将 POST URL 转换为 GET URL（gif 接口）
    // 例如：http://example.com/point/report -> http://example.com/point/track.gif
    const gifUrl = url.replace(/\/report$/, '/track.gif')

    // 将数据编码为URL参数
    const params = new URLSearchParams()
    params.append('data', JSON.stringify(data))
    const fullUrl = `${gifUrl}?${params.toString()}`

    // 检查URL长度限制（大多数浏览器限制约2000字符）
    if (fullUrl.length <= 2000) {
      return { url: fullUrl, tooLong: false }
    }

    // URL太长，尝试压缩数据
    const compressedData = this.compressData(data)
    const compressedParams = new URLSearchParams()
    compressedParams.append('data', compressedData)
    const compressedUrl = `${gifUrl}?${compressedParams.toString()}`

    return { url: compressedUrl, tooLong: compressedUrl.length > 2000 }
  }

  /**
   * GIF图片请求（最终降级方案）
   * 将数据编码到URL参数中，请求一个1x1的透明gif图片
   */
  private async gifRequest(url: string, data: any): Promise<Response> {
    return new Promise((resolve, reject) => {
      try {
        const gifUrl = url.replace(/\/report$/, '/track.gif')
        const result = this.buildGifUrl(url, data)

        if (!result.tooLong) {
          this.loadGifImage(result.url, resolve, reject)
          return
        }

        // 压缩后仍超长：允许降级时抛出错误，由调用方降级到 beacon/fetch 完整上报；
        // 不允许降级时保持原有行为，只发送关键数据
        if (this.config.get<boolean>('allowFallback', true)) {
          reject(new Error('gif url exceeds max length even after compression'))
          return
        }

        const minimalData = {
          appId: data.appId,
          batchId: data.batchId,
          timestamp: data.timestamp,
          eventCount: data.events?.length || 0,
        }
        const minimalParams = new URLSearchParams()
        minimalParams.append('data', JSON.stringify(minimalData))
        this.loadGifImage(`${gifUrl}?${minimalParams.toString()}`, resolve, reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 加载GIF图片
   */
  private loadGifImage(url: string, resolve: (value: Response) => void, reject: (reason?: any) => void): void {
    const img = new Image()

    // 设置超时
    const timeoutId = setTimeout(() => {
      img.onload = null
      img.onerror = null
      reject(new Error('GIF image load timeout'))
    }, this.sendTimeout)

    img.onload = () => {
      clearTimeout(timeoutId)
      resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response)
    }

    img.onerror = () => {
      clearTimeout(timeoutId)
      reject(new Error('GIF image load failed'))
    }

    img.src = url
  }

  /**
   * 压缩数据（简单的Base64编码）
   */
  private compressData(data: any): string {
    try {
      const jsonString = JSON.stringify(data)
      // 使用 Base64 编码（虽然不会真正压缩，但可以确保数据安全传输）
      return btoa(encodeURIComponent(jsonString))
    } catch (error) {
      // 压缩失败，返回原始JSON字符串
      return JSON.stringify(data)
    }
  }

  /**
   * 生成批次ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取客户端IP（通过第三方服务）
   */
  private getClientIP(): string {
    // 这里可以集成第三方IP服务
    // 暂时返回空字符串
    return ''
  }

  /**
   * 获取设备ID
   */
  private getDeviceId(): string {
    const deviceKey = this.config.getStorageKey('device_id')

    try {
      let deviceId = localStorage.getItem(deviceKey)

      if (!deviceId) {
        deviceId = this.generateDeviceId()
        localStorage.setItem(deviceKey, deviceId)
      }

      return deviceId
    } catch {
      // localStorage 不可用（隐私模式/SSR），回退到内存
      return this.generateDeviceId()
    }
  }

  /**
   * 生成设备ID
   */
  private generateDeviceId(): string {
    // 使用Canvas指纹生成设备ID
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillText('ProbeX Device ID', 2, 2)

        const fingerprint = canvas.toDataURL()
        return btoa(fingerprint).substring(0, 32)
      }
    } catch (error) {
      // Canvas指纹生成失败，使用随机字符串
      console.warn('Canvas fingerprint generation failed:', error)
    }

    // 降级方案：使用随机字符串 + 时间戳
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取设备类型
   */
  private getDeviceType(): string {
    const ua = navigator.userAgent

    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      if (/iPad/i.test(ua)) {
        return 'tablet'
      }
      return 'mobile'
    }

    return 'desktop'
  }

  /**
   * 获取UTM参数
   */
  private getUTMParameter(param: string): string {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get(param) || ''
    } catch (error) {
      return ''
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    this.timer = window.setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  /**
   * 停止定时刷新
   */
  private stopFlushTimer(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = []
  }

  /**
   * 获取发送统计
   */
  getStats(): { queueLength: number; retryCount: number; isSending: boolean } {
    return {
      queueLength: this.queue.length,
      retryCount: this.retryCount,
      isSending: this.isSending,
    }
  }

  /**
   * 销毁发送器
   */
  destroy(): void {
    this.stopFlushTimer()

    // 清理待执行的重试定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = undefined
    }

    // 最后一次发送队列中的数据
    if (this.queue.length > 0) {
      if (this.isSending) {
        // 正在异步发送中，改用同步方式（sendBeacon/gif）发送剩余队列，避免 clearQueue 丢数据
        this.flushSync()
      } else {
        this.flush()
      }
    }

    this.clearQueue()
  }
}
