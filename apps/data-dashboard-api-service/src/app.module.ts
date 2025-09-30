import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import {
  JsonBodyInterceptor,
  ResponseInterceptor,
  SignatureInterceptor,
} from "@probe-x/shared-utils/src/lib/backend-common"
import { KafkaModule } from "@modules/kafka.module"
import EnvConfigModule from "./modules/env-config.module"
import { DatabaseModule } from "@modules/database.module"
import { EventModule } from "@src/api/event/event.module"
import { UserModule } from "@src/api/user/user.module"

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
  }, {
    provide: APP_INTERCEPTOR,
    useClass: JsonBodyInterceptor,
  }],
})
export class AppModule {
}
