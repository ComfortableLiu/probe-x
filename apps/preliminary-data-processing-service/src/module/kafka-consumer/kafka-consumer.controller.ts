import { Controller } from '@nestjs/common'
import { KafkaConsumerService } from "@src/module/kafka-consumer/kafka-consumer.service"
import { Ctx, EventPattern, KafkaContext, Payload } from "@nestjs/microservices"
import type { IEventLog } from "@probe-x/shared-types/src"
import { TOPIC_PRELIMINARY_DATA_PROCESSING_POINT_META } from "@probe-x/shared-types/src"

@Controller()
export class KafkaConsumerController {
  constructor(private readonly kafkaConsumerService: KafkaConsumerService) {
  }

  @EventPattern(TOPIC_PRELIMINARY_DATA_PROCESSING_POINT_META)
  async handleUserAction(
    @Payload() event: IEventLog,
    @Ctx() context: KafkaContext,
  ) {
    await this.kafkaConsumerService.handleEvent(event)
    // 处理成功后手动提交 offset（main.ts 中 autoCommit 默认关闭）；
    // handleEvent 抛出可重试错误时不会走到这里，消息等待重投
    const message = context.getMessage()
    await context.getConsumer().commitOffsets([{
      topic: context.getTopic(),
      partition: context.getPartition(),
      offset: (Number(message.offset) + 1).toString(),
    }])
  }
}
