import { Controller } from '@nestjs/common'
import { KafkaConsumerService } from "@src/module/kafka-consumer/kafka-consumer.service"
import { EventPattern, Payload } from "@nestjs/microservices"
import type { IEventLog } from "@probe-x/shared-types/src"
import { TOPIC_PRELIMINARY_DATA_PROCESSING_POINT_META } from "@probe-x/shared-types/src"

@Controller()
export class KafkaConsumerController {
  constructor(private readonly kafkaConsumerService: KafkaConsumerService) {
  }

  @EventPattern(TOPIC_PRELIMINARY_DATA_PROCESSING_POINT_META)
  async handleUserAction(
    @Payload() event: IEventLog,
  ) {
    return await this.kafkaConsumerService.handleEvent(event)
  }
}
