import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Redis } from 'ioredis'
import { RedisModuleOptions } from "@probe-x/shared-types/src"

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis
  private isConnected = false
  private reconnectCount = 0
  private maxReconnectWarnings = 5 // 最多显示5次重连警告

  constructor(options: RedisModuleOptions) {
    const maxReconnectWarnings = this.maxReconnectWarnings
    // 改进的重试策略：限制重试次数，避免无限重连
    const retryStrategy = options.retryStrategy || ((times: number) => {
      // 最多重试10次，之后停止重试
      if (times > 10) {
        console.error('❌ Redis 重连次数超过限制，停止重试')
        return null // 返回 null 停止重试
      }
      const delay = Math.min(times * 50, 2000)
      if (times <= maxReconnectWarnings) {
        console.warn(`⚠️ Redis 正在重连 (第 ${times} 次)，${delay}ms 后重试...`)
      }
      return delay
    })

    // 初始化 Redis 客户端
    this.client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      db: options.db || 0,
      retryStrategy,
      // 添加连接超时配置
      connectTimeout: 10000,
      // 启用自动重连，但由 retryStrategy 控制
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    })

    // 监听连接状态
    // 使用 'ready' 事件代替 'connect'，因为 'ready' 只在客户端完全准备好时触发
    // 注意要用 on 而不是 once，否则断线重连后 isConnected 无法恢复为 true
    this.client.on('ready', () => {
      // 重复日志用连接状态抑制：只有从断开状态恢复时才打印
      if (!this.isConnected) {
        console.log(`✅ Redis 连接成功 (${options.host}:${options.port})`)
      }
      this.isConnected = true
      this.reconnectCount = 0
    })

    // 监听连接事件（用于跟踪重连）
    this.client.on('connect', () => {
      if (this.isConnected) {
        // 如果之前已连接，说明是重连
        this.reconnectCount++
        if (this.reconnectCount <= this.maxReconnectWarnings) {
          console.warn(`⚠️ Redis 连接断开后重新连接 (第 ${this.reconnectCount} 次)`)
        }
      }
    })

    // 监听断开连接事件
    this.client.on('close', () => {
      if (this.isConnected) {
        this.isConnected = false
        console.warn('⚠️ Redis 连接已断开')
      }
    })

    // 监听错误事件
    this.client.on('error', (err) => {
      // 只在未连接时显示错误，避免重复输出
      if (!this.isConnected) {
        console.error(`❌ Redis 连接错误: ${err.message}`)
        // 如果是连接错误，提供诊断信息
        if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
          console.error(`   请检查 Redis 服务是否运行在 ${options.host}:${options.port}`)
        } else if (err.message.includes('NOAUTH') || err.message.includes('invalid password')) {
          console.error(`   Redis 密码验证失败，请检查密码配置`)
        }
      }
    })
  }

  // 获取原始客户端（如需使用 ioredis 全部方法）
  getClient(): Redis {
    return this.client
  }

  // 封装常用方法（按需扩展）
  async set(key: string, value: any, expireSeconds?: number) {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value)
    if (expireSeconds) {
      return this.client.set(key, strValue, 'EX', expireSeconds)
    }
    return this.client.set(key, strValue)
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) // 尝试解析为 JSON
    } catch {
      return value as any
    }
  }

  async del(key: string) {
    return this.client.del(key)
  }

  // 仅当 key 不存在时写入并设置过期时间（用于 nonce 防重放等场景）
  // 返回 true 表示写入成功，false 表示 key 已存在
  async setNx(key: string, value: any, expireSeconds: number): Promise<boolean> {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value)
    const result = await this.client.set(key, strValue, 'EX', expireSeconds, 'NX')
    return result === 'OK'
  }

  /**
   * 根据模式删除匹配的键（使用 SCAN 命令，避免阻塞）
   * @param pattern 匹配模式，例如 'dashboard:list:*'
   * @returns 删除的键数量
   */
  async delByPattern(pattern: string): Promise<number> {
    let deletedCount = 0
    let cursor = '0'

    do {
      // 使用 SCAN 命令遍历匹配的键
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100, // 每次扫描100个键
      )

      cursor = nextCursor

      // 如果有匹配的键，批量删除
      if (keys.length > 0) {
        const deleted = await this.client.del(...keys)
        deletedCount += deleted
      }
    } while (cursor !== '0') // 当 cursor 为 '0' 时表示扫描完成

    return deletedCount
  }

  // 应用关闭时断开连接
  async onModuleDestroy() {
    await this.client.disconnect()
    console.log('🔌 Redis 连接已关闭')
  }
}