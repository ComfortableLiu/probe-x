import { Module } from '@nestjs/common'
import { envConfig, KafkaModule } from "@probe-x/shared-utils/src/lib/backend-common"
import configuration from "../config/configuration"

@Module({
  imports: [
    envConfig(configuration),
    KafkaModule,
  ],
})
export class AppModule {
}
