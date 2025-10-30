import { Module } from '@nestjs/common'
import {
  ClickHouseModule,
  envConfig,
  JsonBodyInterceptor,
  KafkaModule,
  ResponseInterceptor,
  SignatureInterceptor,
  SsoAuthGuard,
} from "@probe-x/shared-utils/src/lib/backend-common"
import { PointModule } from './api/point/point.module'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import configuration from "../config/configuration"
import { JwtModule } from "@nestjs/jwt"
import { ConfigModule, ConfigService } from "@nestjs/config"

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
    ClickHouseModule,
    KafkaModule,
    PointModule,
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
