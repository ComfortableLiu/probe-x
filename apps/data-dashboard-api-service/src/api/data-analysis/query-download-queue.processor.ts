import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import ExcelJS from 'exceljs'
import { ClickHouseService, MinioService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { DimensionLayer } from "@probe-x/shared-types/src"
import { DOWNLOAD_TASK_KEY, IDownloadTask, QUEUE_NAME } from "@src/api/data-analysis/type"
import dayjs from "dayjs"
import { PassThrough } from "node:stream"

@Processor(QUEUE_NAME)
export class QueryDownloadQueueProcessor extends WorkerHost {

  constructor(
    private redisService: RedisService,
    private clickHouseService: ClickHouseService,
    private minioService: MinioService,
  ) {
    super()
  }

  async process(job: Job<IDownloadTask>) {
    const {
      taskId,
      sql,
      sqlParams,
      createTime,
    } = job.data

    const redisKey = DOWNLOAD_TASK_KEY + taskId

    try {
      const result = await this.clickHouseService.query<DimensionLayer>(sql, sqlParams)

      // 创建 Excel 工作簿
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('导出数据')
      let isHeaderSet = false

      // 流式处理查询结果，写入 Excel
      for await (const row of result) {
        // 第一次循环设置表头
        if (!isHeaderSet) {
          const headers = Object.keys(row)
          worksheet.addRow(headers)
          worksheet.getRow(1).font = { bold: true } // 表头加粗
          isHeaderSet = true
        }
        // 写入数据行
        worksheet.addRow(Object.values(row))
      }

      // Excel 流式上传 MinIO（无需本地存储）
      const excelStream = new PassThrough()
      excelStream._read = () => {
      } // 实现 Readable 必需的 _read 方法
      await workbook.xlsx.write(excelStream)
      excelStream.end()

      // MinIO 文件路径（用 taskId 避免重复）
      const exportName = `${dayjs(createTime).format()}`
      const fileName = `${exportName}_${taskId}.xlsx`
      const fileKey = await this.minioService.uploadStream(excelStream, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      // 生成 MinIO 预签名下载链接（默认有效期 30分钟）
      const downloadUrl = await this.minioService.getPresignedDownloadUrl(fileKey)

      // 更新任务状态为“成功”，存储下载链接
      await this.redisService.set(redisKey, {
        ...job.data,
        downloadUrl,
        status: 'SUCCESS',
      }, 30 * 60)

      // 实时推送结果到前端
      // if (global.io) {
      //   global.io.to(taskId).emit('taskComplete', {
      //     taskId,
      //     status: 'success',
      //     downloadUrl,
      //     completeTime: new Date().toISOString(),
      //   })
      // }

    } catch (error) {
      console.error(`任务 ${taskId} 执行失败：`, error)

      // 更新任务状态为“失败”，存储错误信息
      await this.redisService.set(redisKey, {
        ...job.data,
        status: 'FAIL',
      }, 30 * 60)

      // TODO 推送失败通知到前端
      // if (global.io) {
      //   global.io.to(taskId).emit('taskComplete', {
      //     taskId,
      //     status: 'FAIL',
      //     errorMsg: error.message,
      //   })
      // }

      // 抛出错误，BullMQ 标记任务为失败
      throw error
    }
  }

  /**
   * 任务完成回调（可选，用于日志）
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<IDownloadTask>) {
    console.log(`任务 ${job.id} 执行成功`)
  }

  /**
   * 任务失败回调（可选，用于日志/告警）
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<IDownloadTask>, error: Error) {
    console.error(`任务 ${job.id} 执行失败：`, error.message)
  }
}
