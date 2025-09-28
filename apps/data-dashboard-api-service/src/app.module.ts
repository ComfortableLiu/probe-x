import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { KafkaModule } from './kafka/kafka.module'
import { DatabaseModule } from './database/database.module'
import { ResponseInterceptor } from './interceptors/response.interceptor'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { UserModule } from './api/user/user.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './config/.env',
    }),
    DatabaseModule,
    KafkaModule,
    UserModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
