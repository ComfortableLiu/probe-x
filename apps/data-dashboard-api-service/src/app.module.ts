import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { UserModule } from './api/user/user.module'
import { EventModule } from './api/event/event.module'
import { ResponseInterceptor, SignatureInterceptor } from "@probe-x/shared-utils/src/lib/backend-common"
import { KafkaModule } from "@modules/kafka.module"
import EnvConfigModule from "./modules/env-config.module"
import { DatabaseModule } from "@modules/database.module"

@Module({
  imports: [
    EnvConfigModule,
    DatabaseModule,
    KafkaModule,
    UserModule,
    EventModule,
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
