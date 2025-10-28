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

@Module({
  imports: [
    envConfig(configuration),
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
