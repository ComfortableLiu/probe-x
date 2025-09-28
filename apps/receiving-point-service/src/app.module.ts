import { Module } from '@nestjs/common'
import DatabaseModule from "./modules/database.module"
import EnvConfigModule from "./modules/env-config.module"
import { KafkaModule } from './modules/kafka.module'
import { DataModule } from './api/data/data.module'
import { PointModule } from './api/point/point.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor, SignatureInterceptor } from "@shared-utils/backend-common"

@Module({
  imports: [
    EnvConfigModule,
    DatabaseModule,
    KafkaModule,
    DataModule,
    PointModule,
  ],
  providers: [{
    provide: APP_INTERCEPTOR,
    useClass: ResponseInterceptor,
  }, {
    provide: APP_INTERCEPTOR,
    useClass: SignatureInterceptor,
  }],
})
export class AppModule {
}
