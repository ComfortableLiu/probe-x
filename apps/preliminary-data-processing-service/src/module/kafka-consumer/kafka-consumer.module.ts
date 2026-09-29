import { Module } from '@nestjs/common'
import { KafkaConsumerService } from './kafka-consumer.service'
import { KafkaConsumerController } from "@src/module/kafka-consumer/kafka-consumer.controller"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ClickHouseModule, TrackingNodeEntity } from "@probe-x/shared-utils/src/lib/backend-common"

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackingNodeEntity]),
    ClickHouseModule,
  ],
  controllers: [KafkaConsumerController],
  providers: [KafkaConsumerService],
})
export class KafkaConsumerModule {
}
