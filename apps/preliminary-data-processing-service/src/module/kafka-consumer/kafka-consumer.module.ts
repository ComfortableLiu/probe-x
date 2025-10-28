import { Module } from '@nestjs/common'
import { KafkaConsumerService } from './kafka-consumer.service'
import { KafkaConsumerController } from "@src/module/kafka-consumer/kafka-consumer.controller"

@Module({
  imports: [],
  controllers: [KafkaConsumerController],
  providers: [KafkaConsumerService],
})
export class KafkaConsumerModule {
}
