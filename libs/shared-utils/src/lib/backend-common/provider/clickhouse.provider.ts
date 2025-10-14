import { Provider } from '@nestjs/common'
import { ClickHouseClient, createClient } from '@clickhouse/client'
import { ConfigService } from '@nestjs/config'

// 提供器令牌（用于注入）
export const CLICKHOUSE_CLIENT = 'CLICKHOUSE_CLIENT'

// 创建 ClickHouse 客户端提供器
export const ClickHouseProvider: Provider = {
  provide: CLICKHOUSE_CLIENT,
  useFactory: (configService: ConfigService): ClickHouseClient => {
    return createClient({
      url: configService.get<string>('clickhouse.host'),
      username: configService.get<string>('clickhouse.username', 'default'),
      password: configService.get<string>('clickhouse.password', ''),
      database: configService.get<string>('clickhouse.database', 'default'),
      // 可选配置
      // tls: configService.get<boolean>('clickhouse.tls', false),
      request_timeout: configService.get<number>('clickhouse.requestTimeout', 30000),
      max_open_connections: configService.get<number>('clickhouse.connectionTimeout', 10000),
      compression: {
        request: configService.get<boolean>('clickhouse.compression', true), // 请求压缩
        response: configService.get<boolean>('clickhouse.compression', true), // 响应压缩
      },
    })
  },
  inject: [ConfigService], // 注入配置服务
}
