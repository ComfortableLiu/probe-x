import { Module } from '@nestjs/common'
import { KafkaModule } from '@modules/kafka.module'
import { DatabaseModule } from '@modules/database.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { UserModule } from './api/user/user.module'
import { ResponseInterceptor, SignatureInterceptor } from "@shared-utils/backend-common"
import EnvConfigModule from "@modules/env-config.module"

@Module({
  imports: [
    EnvConfigModule,
    DatabaseModule,
    KafkaModule,
    UserModule,
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
