import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import {
  envConfig,
  JsonBodyInterceptor,
  KafkaModule,
  MysqlModule,
  RedisModule,
  RedisService,
  ResponseInterceptor,
  SignatureInterceptor,
  SsoAuthGuard,
} from "@probe-x/shared-utils/src/lib/backend-common"
import { EventModule } from "@src/api/event/event.module"
import { UserModule } from "@src/api/user/user.module"
import { JwtModule } from "@nestjs/jwt"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { PropertyModule } from "@src/api/property/property.module"
import { TrackingNodeModule } from "@src/api/tracking-node/tracking-node.module"
import configuration from "../config/configuration"
import { DataAnalysisModule } from "@src/api/data-analysis/data-analysis.module"
import { BullModule } from "@nestjs/bullmq"
import { SystemDataModule } from "@src/api/system-data/system-data.module"

@Module({
  imports: [
    envConfig(configuration),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'defaultSecret',
      }),
      inject: [ConfigService],
    }),
    RedisModule.forRoot(),
    // 注册 BullMQ 模块（核心！复用 Redis 配置）
    BullModule.forRootAsync({
      useFactory: (redisService: RedisService) => ({
        connection: redisService.getClient().options,
        // 全局任务默认配置（可选）
        defaultJobOptions: {
          attempts: 1, // 失败不重试（长耗时任务可按需调整）
          timeout: 1000 * 60 * 60, // 1小时超时
          removeOnComplete: false, // 完成后保留任务（便于排查）
          removeOnFail: false, // 失败后保留任务
        },
      }),
      inject: [RedisService], // 注入配置服务
    }),
    MysqlModule.forRoot(),
    KafkaModule,
    UserModule,
    EventModule,
    PropertyModule,
    TrackingNodeModule,
    DataAnalysisModule,
    SystemDataModule,
  ],
  providers: [{
    provide: APP_INTERCEPTOR,
    useClass: ResponseInterceptor,
  }, {
    provide: APP_INTERCEPTOR,
    useClass: SignatureInterceptor,
  }, {
    provide: APP_INTERCEPTOR,
    useClass: JsonBodyInterceptor,
  }, {
    provide: APP_GUARD,
    useClass: SsoAuthGuard,
  }],
})
export class AppModule {
}
