import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import {
  JsonBodyInterceptor,
  ResponseInterceptor,
  SignatureInterceptor,
  SsoAuthGuard,
} from "@probe-x/shared-utils/src/lib/backend-common"
import { KafkaModule } from "@modules/kafka.module"
import EnvConfigModule from "./modules/env-config.module"
import { DatabaseModule } from "@modules/database.module"
import { EventModule } from "@src/api/event/event.module"
import { UserModule } from "@src/api/user/user.module"
import { JwtModule } from "@nestjs/jwt"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { PropertyModule } from "@src/api/property/property.module"

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'defaultSecret',
      }),
      inject: [ConfigService],
    }),
    EnvConfigModule,
    DatabaseModule,
    KafkaModule,
    UserModule,
    EventModule,
    PropertyModule,
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
