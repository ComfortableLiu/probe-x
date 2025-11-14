import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import {
  envConfig,
  JsonBodyInterceptor,
  KafkaModule,
  MysqlModule,
  ResponseInterceptor,
  SignatureInterceptor,
  SsoAuthGuard,
} from "@probe-x/shared-utils/src/lib/backend-common"
import { EventModule } from "@src/api/event/event.module"
import { UserModule } from "@src/api/user/user.module"
import { JwtModule } from "@nestjs/jwt"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { PropertyModule } from "@src/api/property/property.module"
import { TrackingNodeModule } from "@src/api/tracking-node/tracking-node.module"
import configuration from "../config/configuration"
import { DataAnalysisModule } from "@src/api/data-analysis/data-analysis.module"

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'defaultSecret',
      }),
      inject: [ConfigService],
    }),
    envConfig(configuration),
    MysqlModule.forRoot(),
    KafkaModule,
    UserModule,
    EventModule,
    PropertyModule,
    TrackingNodeModule,
    DataAnalysisModule,
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
