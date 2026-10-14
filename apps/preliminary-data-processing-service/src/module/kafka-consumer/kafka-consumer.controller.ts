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
    const message = context.getMessage()
    // offset 提交统一交给 service：只在数据落库成功（或确认为脏数据）后按分区连续完成前缀提交，
    // 仅入内存缓冲就提交会在进程崩溃/OOM 时永久丢失缓冲区数据（main.ts 中 autoCommit 默认关闭）；
    // handleEvent 抛出可重试错误时不推进位点，消息等待重投
    await this.kafkaConsumerService.handleEvent(
      event,
      {
        topic: context.getTopic(),
        partition: context.getPartition(),
        offset: Number(message.offset),
      },
      (offsets) => context.getConsumer().commitOffsets(offsets),
    )
  }
}
