import { Module } from '@nestjs/common'
import { envConfig, MysqlModule, RedisModule } from "@probe-x/shared-utils/src/lib/backend-common"
import configuration from "../config/configuration"
import { KafkaConsumerModule } from "@src/module/kafka-consumer/kafka-consumer.module"

@Module({
  imports: [
    envConfig(configuration),
    KafkaConsumerModule,
    RedisModule.forRoot(),
    MysqlModule.forRoot(),
  ],
})
export class AppModule {
}
