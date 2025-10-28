import { Injectable } from '@nestjs/common'
import type { IEvent } from "@probe-x/shared-types/src"
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"

@Injectable()
export class KafkaConsumerService {
  constructor(
    private clickhouseService: ClickHouseService,
  ) {
  }

  async handleEvent(event: IEvent) {
    // TODO 初步补充数据逻辑

    // 保存到数据库
    await this.clickhouseService.insert('event_log', [event])
  }
}