import { Injectable } from '@nestjs/common'
import type { IEvent } from "@probe-x/shared-types/src"
import { ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"

@Injectable()
export class KafkaConsumerService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
  ) {
  }

  async handleEvent(event: IEvent) {
    // TODO 初步补充数据逻辑
    // 1. Session切割

    // 2. utm 补充

    // 3. scm/spm 信息解析

    // 保存到数据库
    await this.clickhouseService.insert('event_log', [event])
  }
}
