import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import ExcelJS from 'exceljs'
import { ClickHouseService, MinioService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { DOWNLOAD_TASK_KEY, IDownloadTask, QUEUE_NAME } from "@src/api/data-analysis/type"
import dayjs from "dayjs"
import { PassThrough } from "node:stream"
import { DataAnalysisRecordService } from "./record.service"
import { Inject } from "@nestjs/common"

@Processor(QUEUE_NAME)
export class QueryDownloadQueueProcessor extends WorkerHost {

  constructor(
    private redisService: RedisService,
    private clickHouseService: ClickHouseService,
    private minioService: MinioService,
    @Inject(DataAnalysisRecordService) private dataAnalysisRecordService: DataAnalysisRecordService,
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
      const result = await this.clickHouseService.query<any>(sql, sqlParams)

      // 创建 Excel 工作簿
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('导出数据')
      let isHeaderSet = false

      // 流式处理查询结果，写入 Excel
      for await (const row of result) {
        // 留存分析任务：将原始行转换为中文表头的网格行（对象 key 顺序即 Excel 列顺序），其他任务逻辑不变
        const exportRow = job.data.analysisType === 'retention'
          ? this.buildRetentionGridRow(row, job.data.retentionWindows || [], job.data.granularity)
          : row

        // 第一次循环设置表头
        if (!isHeaderSet) {
          const headers = Object.keys(exportRow)
          worksheet.addRow(headers)
          worksheet.getRow(1).font = { bold: true } // 表头加粗
          isHeaderSet = true
        }
        // 写入数据行
        worksheet.addRow(Object.values(exportRow))
      }

      // Excel 流式上传 MinIO（无需本地存储），生成与上传并行，避免数据超过 highWaterMark 时死锁
      const excelStream = new PassThrough()

      // MinIO 文件路径（用 taskId 避免重复）
      const exportName = `${dayjs(createTime).format()}`
      const fileName = `${exportName}_${taskId}.xlsx`
      const [fileKey] = await Promise.all([
        this.minioService.uploadStream(excelStream, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        workbook.xlsx.write(excelStream).then(() => {
          excelStream.end()
        }, (err) => {
          excelStream.destroy(err)
          throw err
        }),
      ])

      // 生成 MinIO 预签名下载链接（默认有效期 30分钟）
      const downloadUrl = await this.minioService.getPresignedDownloadUrl(fileKey)

      // 更新任务状态为"成功"，存储下载链接
      await this.redisService.set(redisKey, {
        ...job.data,
        downloadUrl,
        status: 'SUCCESS',
      }, 30 * 60)

      // 更新任务记录
      const resultSize = Array.isArray(result) ? result.length : 0
      await this.dataAnalysisRecordService.updateTaskStatus(taskId, 2, resultSize, undefined, Math.floor((Date.now() - createTime) / 1000))

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

      // 更新任务状态为"失败"，存储错误信息
      await this.redisService.set(redisKey, {
        ...job.data,
        status: 'FAIL',
      }, 30 * 60)

      // 更新任务记录为失败状态
      await this.dataAnalysisRecordService.updateTaskStatus(taskId, 3, undefined, error.message)

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
   * 构建留存分析下载的网格行（中文表头，对象 key 顺序即 Excel 列顺序）
   * 列顺序：队列日期 → 队列用户数 → 维度列（列名保持原样）→ 各窗口的「第N日/周/月留存率 / 第N日/周/月留存人数」
   * 窗口单位跟随时间粒度（granularity：DAY/WEEK/MONTH）
   */
  private buildRetentionGridRow(row: Record<string, any>, retentionWindows: number[], granularity?: string): Record<string, any> {
    const gridRow: Record<string, any> = {
      队列日期: row.cohort_date,
      队列用户数: row.cohort_size,
    }

    // 维度列：除 cohort_date / cohort_size / retention_* 之外的列，追加在「队列用户数」之后
    Object.keys(row).forEach(key => {
      if (key === 'cohort_date' || key === 'cohort_size' || /^retention_(users|rate)_\d+d$/.test(key)) return
      gridRow[key] = row[key]
    })

    // 窗口单位跟随粒度：第 N 日 / 第 N 周 / 第 N 月
    const unitLabel = granularity === 'WEEK' ? '周' : granularity === 'MONTH' ? '月' : '日'

    // 窗口列：按 retentionWindows 顺序，每个窗口两列（先留存率、后留存人数）
    retentionWindows.forEach(day => {
      const rate = row[`retention_rate_${day}d`]
      // 留存率保留两位小数格式化为 xx.xx%（SQL 已输出百分数），值缺失时为 0%
      gridRow[`第${day}${unitLabel}留存率`] = rate === null || rate === undefined || Number.isNaN(Number(rate))
        ? '0%'
        : `${Number(rate).toFixed(2)}%`
      gridRow[`第${day}${unitLabel}留存人数`] = Number(row[`retention_users_${day}d`]) || 0
    })

    return gridRow
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
