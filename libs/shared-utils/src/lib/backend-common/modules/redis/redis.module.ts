// src/redis/redis.module.ts
import { DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config' // 导入已有的 ConfigService
import { RedisService } from './redis.service'

@Global()
@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: 'REDIS_OPTIONS',
          useFactory: (configService: ConfigService) => ({
            host: configService.get<string>('redis.host') || 'localhost',
            port: configService.get<number>('redis.port') || 6379,
            password: configService.get<string>('redis.password'), // 可选，无密码则为 undefined
            db: configService.get<number>('redis.db') || 0,
            // 不传 retryStrategy，使用 RedisService 内置策略（重试 10 次后停止）
          }),
          inject: [ConfigService], // 注入已有的 ConfigService
        },
        {
          provide: RedisService,
          useFactory: (options) => new RedisService(options),
          inject: ['REDIS_OPTIONS'],
        },
      ],
      exports: [RedisService],
    }
  }
}