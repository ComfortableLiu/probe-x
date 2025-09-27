import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DashboardModule } from './api/dashboard/dashboard.module'
import { AnalyticsModule } from './api/analytics/analytics.module'
import { KafkaModule } from './kafka/kafka.module'
import { DatabaseModule } from './database/database.module'
import { ResponseInterceptor } from './interceptors/response.interceptor'
import { APP_INTERCEPTOR } from '@nestjs/core'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './config/env/.env',
    }),
    DatabaseModule,
    KafkaModule,
    DashboardModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
