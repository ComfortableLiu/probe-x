import { Module } from '@nestjs/common'
import EnvConfigModule from "./modules/env-config.module"
import { KafkaModule } from './modules/kafka.module'
import { PointModule } from './api/point/point.module'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import {
  ClickHouseModule,
  JsonBodyInterceptor,
  ResponseInterceptor,
  SignatureInterceptor,
  SsoAuthGuard,
} from "@probe-x/shared-utils/src/lib/backend-common"

@Module({
  imports: [
    EnvConfigModule,
    ClickHouseModule,
    // DatabaseModule,
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
