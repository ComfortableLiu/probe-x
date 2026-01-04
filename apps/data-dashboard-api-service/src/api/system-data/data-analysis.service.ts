import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  ClickHouseService,
  DataAnalysisAccessStatsEntity,
  DataAnalysisExportLogEntity,
  DataAnalysisQueryStatsEntity,
  DataAnalysisTaskLogEntity,
} from '@probe-x/shared-utils/src/lib/backend-common'
import { IDataAnalysisStatistics, IDataAnalysisTrend, ISystemDataAnalysisState } from '@probe-x/shared-types/src'

/**
 * 数据分析服务
 * 提供数据分析功能相关的统计、趋势、任务管理等功能
 */
@Injectable()
export class DataAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
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
   * 获取数据分析统计信息
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns IDataAnalysisStatistics 数据分析统计信息
   */
  async getAnalysisStatistics(date?: string): Promise<IDataAnalysisStatistics> {
    try {
      // 构建日期条件参数
      const dateParam = date ? { date } : undefined

      // 查询分析功能的查询次数
      const queryCountResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select('COUNT(*)', 'count')
        .where(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const queryCount = parseInt(queryCountResult.count || '0', 10)

      // 查询分析功能的查询人数
      const userCountResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select('COUNT(DISTINCT user_id)', 'count')
        .where(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const userCount = parseInt(userCountResult.count || '0', 10)

      // 查询平均耗时
      const avgDurationResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select('AVG(query_duration)', 'avg_duration')
        .where(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const avgDuration = Math.round(parseFloat(avgDurationResult.avg_duration || '0'))
      const avgDurationStr = `${avgDuration}ms`

      // 查询失败率
      const totalResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select('COUNT(*)', 'total')
        .where(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const total = parseInt(totalResult.total || '0', 10)

      const failedResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select('COUNT(*)', 'failed')
        .where('is_success = 0')
        .andWhere(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const failed = parseInt(failedResult.failed || '0', 10)
      const failureRate = total > 0 ? (failed / total * 100).toFixed(2) + '%' : '0.00%'

      // 查询排队中的任务数
      const queuedTasksResult = await this.dataAnalysisTaskLogRepository
        .createQueryBuilder('task')
        .select('COUNT(*)', 'count')
        .where('status = 0')
        .andWhere(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const queuedTasks = parseInt(queuedTasksResult.count || '0', 10)

      // 查询计算中的任务数
      const processingTasksResult = await this.dataAnalysisTaskLogRepository
        .createQueryBuilder('task')
        .select('COUNT(*)', 'count')
        .where('status = 1')
        .andWhere(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const processingTasks = parseInt(processingTasksResult.count || '0', 10)

      // 查询已终止的任务数
      const terminatedTasksResult = await this.dataAnalysisTaskLogRepository
        .createQueryBuilder('task')
        .select('COUNT(*)', 'count')
        .where('status = 3')
        .andWhere(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const terminatedTasks = parseInt(terminatedTasksResult.count || '0', 10)

      // 查询导出数据次数
      const exportCountResult = await this.dataAnalysisExportLogRepository
        .createQueryBuilder('export')
        .select('COUNT(*)', 'count')
        .where(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const exportCount = parseInt(exportCountResult.count || '0', 10)

      // 查询导出数据人数
      const exportUserCountResult = await this.dataAnalysisExportLogRepository
        .createQueryBuilder('export')
        .select('COUNT(DISTINCT user_id)', 'count')
        .where(date ? 'DATE(create_time) = :date' : '1=1', dateParam)
        .getRawOne()

      const exportUserCount = parseInt(exportUserCountResult.count || '0', 10)

      return {
        queryCount,
        userCount,
        avgDuration: avgDurationStr,
        failureRate,
        queuedTasks,
        processingTasks,
        terminatedTasks,
        exportCount,
        exportUserCount,
      }
    } catch (error) {
      console.error('Error fetching analysis statistics:', error)
      return {
        queryCount: 0,
        userCount: 0,
        avgDuration: '0ms',
        failureRate: '0%',
        queuedTasks: 0,
        processingTasks: 0,
        terminatedTasks: 0,
        exportCount: 0,
        exportUserCount: 0,
      }
    }
  }

  /**
   * 获取数据分析趋势
   * @param days 查询天数，默认30天
   * @param startDate 开始日期，格式为 YYYY-MM-DD
   * @param endDate 结束日期，格式为 YYYY-MM-DD
   * @returns IDataAnalysisTrend 数据分析趋势信息
   */
  async getAnalysisTrend(days: number = 30, startDate?: string, endDate?: string): Promise<IDataAnalysisTrend> {
    try {
      // 构建日期范围查询参数
      let whereCondition: string
      let whereParams: any = {}

      if (startDate && endDate) {
        whereCondition = 'DATE(create_time) BETWEEN :startDate AND :endDate'
        whereParams = { startDate, endDate }
      } else {
        whereCondition = 'DATE(create_time) >= DATE_SUB(CURDATE(), INTERVAL :days DAY)'
        whereParams = { days }
      }

      // 查询每日查询次数趋势
      const queryTrendResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select([
          'DATE(create_time) as date',
          'COUNT(*) as count',
        ])
        .where(whereCondition, whereParams)
        .groupBy('DATE(create_time)')
        .orderBy('DATE(create_time)', 'ASC')
        .getRawMany()

      // 查询每日查询人数趋势
      const userTrendResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select([
          'DATE(create_time) as date',
          'COUNT(DISTINCT user_id) as count',
        ])
        .where(whereCondition, whereParams)
        .groupBy('DATE(create_time)')
        .orderBy('DATE(create_time)', 'ASC')
        .getRawMany()

      // 整合数据
      const allDates = new Set([
        ...queryTrendResult.map(item => item.date),
        ...userTrendResult.map(item => item.date),
      ])

      const sortedDates = Array.from(allDates).sort()

      const queryCounts = []
      const userCounts = []

      for (const date of sortedDates) {
        const queryData = queryTrendResult.find(item => item.date === date)
        const userData = userTrendResult.find(item => item.date === date)

        queryCounts.push(queryData ? parseInt(queryData.count) : 0)
        userCounts.push(userData ? parseInt(userData.count) : 0)
      }

      return {
        dates: sortedDates,
        queryCounts,
        userCounts,
      }
    } catch (error) {
      console.error('Error fetching analysis trend:', error)
      return {
        dates: [],
        queryCounts: [],
        userCounts: [],
      }
    }
  }

  /**
   * 获取数据分析任务列表
   * @param page 页码，默认为1
   * @param pageSize 每页大小，默认为10
   * @param status 任务状态筛选
   * @returns ISystemDataAnalysisState 数据分析任务列表
   */
  async getAnalysisTasks(page: number = 1, pageSize: number = 10, status?: number): Promise<ISystemDataAnalysisState> {
    try {
      const queryBuilder = this.dataAnalysisTaskLogRepository
        .createQueryBuilder('task')
        .select([
          'task.id as id',
          'task.taskName as taskName',
          'task.initiatorName as initiator',
          'task.status as status',
          'task.startTime as startTime',
          'task.endTime as endTime',
          'task.duration as duration',
        ])

      if (status !== undefined) {
        queryBuilder.andWhere('task.status = :status', { status })
      }

      queryBuilder
        .orderBy('task.createTime', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)

      const result = await queryBuilder.getRawAndEntities()

      // 构建查询总数的查询构建器
      const countQueryBuilder = this.dataAnalysisTaskLogRepository.createQueryBuilder('task')
      if (status !== undefined) {
        countQueryBuilder.where('task.status = :status', { status })
      }

      const total = await countQueryBuilder.getCount()

      // 将状态码转换为状态名称
      const statusMap = {
        0: '排队中',
        1: '计算中',
        2: '已完成',
        3: '已终止',
      }

      const formattedTasks = result.raw.map(task => ({
        ...task,
        status: statusMap[task.status] || '未知',
        duration: task.duration ? `${task.duration}秒` : '进行中',
        endTime: task.endTime || '-',
      }))

      return {
        data: formattedTasks,
        total,
        page,
        pageSize,
      }
    } catch (error) {
      console.error('Error fetching analysis tasks:', error)
      return {
        data: [],
        total: 0,
        page,
        pageSize,
      }
    }
  }

  /**
   * 获取小时级数据分析趋势
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns 包含小时级趋势数据的对象
   */
  async getHourlyAnalysisTrend(date?: string): Promise<any> {
    try {
      // 构建日期条件参数
      const dateParam = date ? { date } : undefined

      // 查询每小时的查询次数
      const queryTrendResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select([
          'HOUR(create_time) as hour',
          'COUNT(*) as count',
        ])
        .where(date ? 'DATE(create_time) = :date' : 'DATE(create_time) = CURDATE()', dateParam)
        .groupBy('HOUR(create_time)')
        .orderBy('HOUR(create_time)', 'ASC')
        .getRawMany()

      // 查询每小时的查询人数
      const userTrendResult = await this.dataAnalysisQueryStatsRepository
        .createQueryBuilder('stats')
        .select([
          'HOUR(create_time) as hour',
          'COUNT(DISTINCT user_id) as count',
        ])
        .where(date ? 'DATE(create_time) = :date' : 'DATE(create_time) = CURDATE()', dateParam)
        .groupBy('HOUR(create_time)')
        .orderBy('HOUR(create_time)', 'ASC')
        .getRawMany()

      // 生成24小时数组
      const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)
      const queryCounts = Array(24).fill(0)
      const userCounts = Array(24).fill(0)

      // 填充数据
      queryTrendResult.forEach(item => {
        const hour = parseInt(item.hour)
        if (hour >= 0 && hour < 24) {
          queryCounts[hour] = parseInt(item.count)
        }
      })

      userTrendResult.forEach(item => {
        const hour = parseInt(item.hour)
        if (hour >= 0 && hour < 24) {
          userCounts[hour] = parseInt(item.count)
        }
      })

      return {
        hours,
        queryCounts,
        userCounts,
      }
    } catch (error) {
      console.error('Error fetching hourly analysis trend:', error)
      return {
        hours: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        queryCounts: Array(24).fill(0),
        userCounts: Array(24).fill(0),
      }
    }
  }
}