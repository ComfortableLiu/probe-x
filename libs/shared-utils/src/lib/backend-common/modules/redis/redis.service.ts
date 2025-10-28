// src/redis/redis.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Redis } from 'ioredis'
import { RedisModuleOptions } from "./type"

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis

  constructor(options: RedisModuleOptions) {
    // 初始化 Redis 客户端
    this.client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      db: options.db || 0,
      retryStrategy: options.retryStrategy || (times => Math.min(times * 50, 2000)),
    })

    // 监听连接状态
    this.client.on('connect', () => {
      console.log('✅ Redis 连接成功')
    })

    this.client.on('error', (err) => {
      console.error('❌ Redis 连接失败:', err.message)
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

  async get(key: string) {
    const value = await this.client.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) // 尝试解析为 JSON
    } catch {
      return value // 非 JSON 直接返回字符串
    }
  }

  async del(key: string) {
    return this.client.del(key)
  }

  // 应用关闭时断开连接
  async onModuleDestroy() {
    await this.client.disconnect()
    console.log('🔌 Redis 连接已关闭')
  }
}