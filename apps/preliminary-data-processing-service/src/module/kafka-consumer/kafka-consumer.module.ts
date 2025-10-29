import { Module } from '@nestjs/common'
import { KafkaConsumerService } from './kafka-consumer.service'
import { KafkaConsumerController } from "@src/module/kafka-consumer/kafka-consumer.controller"
import { TypeOrmModule } from "@nestjs/typeorm"
import { TrackingNodeEntity } from "@probe-x/shared-utils/src/lib/backend-common"

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackingNodeEntity]),
  ],
  controllers: [KafkaConsumerController],
  providers: [KafkaConsumerService],
})
export class KafkaConsumerModule {
}
