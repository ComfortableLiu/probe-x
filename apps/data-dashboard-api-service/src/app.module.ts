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
  // SignatureInterceptor, // 已移除：HMAC签名需要客户端持有密钥，本质上不安全，后续应使用服务端签名方案
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
import { SystemConfigModule } from "@src/api/system-config/system-config.module"
import { DashboardModule } from "@src/api/dashboard/dashboard.module"
import { HomepageModule } from "@src/api/homepage/homepage.module"
import { ComputeNodeModule } from "@src/api/compute-node/compute-node.module"
import { ProjectModule } from "@src/api/project/project.module"
import { AlertModule } from "@src/api/alert/alert.module"
import { AuditLogModule } from "@src/api/audit-log/audit-log.module"
import { DataSourceModule } from "@src/api/datasource/datasource.module"
import { NotificationModule } from "@src/api/notification/notification.module"

@Module({
  imports: [
    envConfig(configuration),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret')
        if (!secret) {
          throw new Error('JWT_SECRET 环境变量未配置，服务无法启动')
        }
        return { secret }
      },
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
    SystemConfigModule,
    DashboardModule,
    HomepageModule,
    ComputeNodeModule,
    ProjectModule,
    AlertModule,
    AuditLogModule,
    DataSourceModule,
    NotificationModule,
  ],
  providers: [{
    provide: APP_INTERCEPTOR,
    useClass: ResponseInterceptor,
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
