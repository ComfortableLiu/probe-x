import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  DataAnalysisAccessStatsEntity,
  DataAnalysisExportLogEntity,
  DataAnalysisQueryStatsEntity,
  DataAnalysisTaskLogEntity,
} from '@probe-x/shared-utils/src/lib/backend-common'
import { IUser } from '@probe-x/shared-types/src'

@Injectable()
export class DataAnalysisRecordService {
  constructor(
    @InjectRepository(DataAnalysisTaskLogEntity)
    private dataAnalysisTaskLogRepository: Repository<DataAnalysisTaskLogEntity>,
    @InjectRepository(DataAnalysisQueryStatsEntity)
    private dataAnalysisQueryStatsRepository: Repository<DataAnalysisQueryStatsEntity>,
    @InjectRepository(DataAnalysisExportLogEntity)
    private dataAnalysisExportLogRepository: Repository<DataAnalysisExportLogEntity>,
    @InjectRepository(DataAnalysisAccessStatsEntity)
    private dataAnalysisAccessStatsRepository: Repository<DataAnalysisAccessStatsEntity>,
  ) {
  }

  /**
   * 记录数据分析查询操作
   */
  async recordQuery(user: IUser, queryContent: string, duration: number, resultSize: number, isSuccess: boolean, errorMsg?: string) {
    const queryStats = new DataAnalysisQueryStatsEntity()
    queryStats.queryDate = new Date()
    queryStats.userId = user.userId
    queryStats.userName = user.username
    queryStats.queryContent = queryContent
    queryStats.queryTime = new Date()
    queryStats.queryDuration = duration
    queryStats.resultSize = resultSize
    queryStats.isSuccess = isSuccess ? 1 : 0
    queryStats.errorMsg = errorMsg

    await this.dataAnalysisQueryStatsRepository.save(queryStats)
  }

  /**
   * 记录数据分析任务
   */
  async recordTask(taskId: string, taskName: string, user: IUser, queryContent: string, status: number = 0) {
    const taskLog = new DataAnalysisTaskLogEntity()
    taskLog.taskId = taskId
    taskLog.taskName = taskName
    taskLog.initiatorId = user.userId
    taskLog.initiatorName = user.username
    taskLog.queryContent = queryContent
    taskLog.status = status
    taskLog.startTime = new Date()

    await this.dataAnalysisTaskLogRepository.save(taskLog)
  }

  /**
   * 更新数据分析任务状态
   */
  async updateTaskStatus(taskId: string, status: number, resultSize?: number, errorMsg?: string, duration?: number) {
    const updateData: any = { status }

    if (resultSize !== undefined) {
      updateData.resultSize = resultSize
    }

    if (errorMsg) {
      updateData.errorMsg = errorMsg
    }

    if (duration !== undefined) {
      updateData.duration = duration
    }

    if (status === 2 || status === 3) { // 完成或终止状态
      updateData.endTime = new Date()
    }

    await this.dataAnalysisTaskLogRepository.update({ taskId }, updateData)
  }

  /**
   * 记录数据分析导出操作
   */
  async recordExport(user: IUser, exportType: string, exportContent: string, exportParams: any, filePath?: string, fileSize?: number, status: number = 1) {
    const exportLog = new DataAnalysisExportLogEntity()
    exportLog.exportId = `export_${Date.now()}_${user.userId}`
    exportLog.userId = user.userId
    exportLog.userName = user.username
    exportLog.exportType = exportType
    exportLog.exportContent = exportContent
    exportLog.exportParams = exportParams
    exportLog.filePath = filePath
    exportLog.fileSize = fileSize
    exportLog.status = status
    exportLog.startTime = new Date()
    exportLog.endTime = new Date()
    exportLog.duration = 0 // 导出通常是同步操作，暂时设为0

    await this.dataAnalysisExportLogRepository.save(exportLog)
  }

  /**
   * 记录数据分析访问统计
   */
  async recordAccess(user: IUser, accessType: string, accessPath: string, ip?: string, userAgent?: string) {
    const accessStats = new DataAnalysisAccessStatsEntity()
    accessStats.accessDate = new Date()
    accessStats.userId = user.userId
    accessStats.userName = user.username
    accessStats.accessTime = new Date()
    accessStats.accessType = accessType
    accessStats.accessPath = accessPath
    accessStats.ipAddress = ip
    accessStats.userAgent = userAgent
    await this.dataAnalysisAccessStatsRepository.save(accessStats)
  }
}
