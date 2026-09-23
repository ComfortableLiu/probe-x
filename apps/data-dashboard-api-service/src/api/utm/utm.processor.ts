import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { UtmService } from './utm.service'
import { QUEUE_NAME, QUEUE_TASK_NAME } from './type'

@Processor(QUEUE_NAME)
export class UtmProcessor extends WorkerHost {
  private readonly logger = new Logger(UtmProcessor.name)

  constructor(private readonly utmService: UtmService) {
    super()
  }

  /**
   * 每日增量统计：把游标之后到目标日的新增量累加进统计表，并推进游标
   * 由单例 repeatable job 每日触发
   */
  async process(job: Job) {
    if (job.name !== QUEUE_TASK_NAME) return

    try {
      const result = await this.utmService.runDaily()
      this.logger.log(
        `每日 UTM 统计完成 [${result.fromDate}, ${result.toDate}]：扫描 ${result.scanned}，` +
        `新增 ${result.inserted}，累加 ${result.updated}，软删跳过 ${result.skipped}，游标 ${result.cursorDate ?? '未建立'}`,
      )
    } catch (error) {
      // 失败留痕并抛出，让 job 落到失败集里
      // 游标不会推进，下一轮自动重跑同一段区间，不会漏统计
      this.logger.error('每日 UTM 统计失败', error)
      throw error
    }
  }
}
