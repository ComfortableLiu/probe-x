import { Injectable } from '@nestjs/common'
import { ClickHouseService } from '@probe-x/shared-utils/src/lib/backend-common'
import {
  IComputingNodeStatus,
  IEventCollectionMetrics,
  IRealTimeProcessingMetrics,
  ISystemDataOverviewResponse,
  ISystemPerformanceMetrics,
  ISystemDataMetaOverview,
} from '@probe-x/shared-types/src'
import { MetaService } from './meta.service'

@Injectable()
export class OverviewService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly metaService: MetaService,
  ) {}

  /**
   * 获取系统数据概览信息
   * @returns ISystemDataOverviewResponse 系统数据概览信息
   */
  async getSystemDataOverview(): Promise<ISystemDataOverviewResponse> {
    try {
      // 并行获取各项数据
      const [
        computingNodeStatus,
        systemPerformanceMetrics,
        eventCollectionMetrics,
        realTimeProcessingMetrics,
        metaOverview,
      ] = await Promise.all([
        this.getComputingNodeStatus(),
        this.getSystemPerformanceMetrics(),
        this.getEventCollectionMetrics(),
        this.getRealTimeProcessingMetrics(),
        this.getMetaOverview(),
      ])

      return {
        computingNodeStatus,
        systemPerformanceMetrics,
        eventCollectionMetrics,
        realTimeProcessingMetrics,
        metaOverview,
      }
    } catch (error) {
      console.error('Error fetching system data overview:', error)
      throw error
    }
  }

  /**
   * 获取元事件概览
   * @returns ISystemDataMetaOverview 元事件概览信息
   */
  private async getMetaOverview(): Promise<ISystemDataMetaOverview> {
    try {
      // 直接调用MetaService的getMetaOverview方法
      return await this.metaService.getMetaOverview();
    } catch (error) {
      console.error('Error fetching meta overview:', error);
      // 返回默认值
      return {
        originalDataTotal: '0',
        finalCleanedData: '0',
        firstCleaningSuccessRate: 0,
        finalCleaningSuccessRate: 0,
      };
    }
  }

  /**
   * 获取计算节点状态
   * @returns IComputingNodeStatus 计算节点状态
   */
  private async getComputingNodeStatus(): Promise<IComputingNodeStatus> {
    // TODO: 从实际的节点管理服务或数据库获取节点状态
    // 这里使用模拟数据
    return {
      totalNodes: 24,
      onlineNodes: 22,
      offlineNodes: 2,
      onlineRate: 91.67,
      cpuUsage: 65.2,
      memoryUsage: 72.8,
      avgLoad: 2.45,
      networkTraffic: 1.25, // Gbps
    }
  }

  /**
   * 获取系统性能指标
   * @returns ISystemPerformanceMetrics 系统性能指标
   */
  private async getSystemPerformanceMetrics(): Promise<ISystemPerformanceMetrics> {
    // TODO: 从实际监控系统获取性能指标
    // 这里使用模拟数据
    return {
      currentQps: 1234,
      peakQps: 2345,
      avgQps: 876,
      avgResponseTime: 45.2, // ms
      p95ResponseTime: 120.5, // ms
      p99ResponseTime: 210.8, // ms
      systemAvailability: 99.95, // %
      currentMonthAvailability: 99.98, // %
      requestErrorRate: 0.02, // %
      systemErrorRate: 0.01, // %
      exceptionCaptureRate: 0.03, // %
    }
  }

  /**
   * 获取事件收集指标
   * @returns IEventCollectionMetrics 事件收集指标
   */
  private async getEventCollectionMetrics(): Promise<IEventCollectionMetrics> {
    // TODO: 从ClickHouse获取事件收集数据
    // 构建日期条件
    const todayCondition = "AND toDate(`$service_time`) = today()"
    const yesterdayCondition = "AND toDate(`$service_time`) = yesterday()"
    const weekCondition = "AND toDate(`$service_time`) >= today() - 7"
    const monthCondition = "AND toDate(`$service_time`) >= today() - 30"

    try {
      // 查询今日收集量
      const todayResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM event_log
         WHERE 1 = 1 ${todayCondition}`,
      )
      const todayCount = parseInt(todayResult[0]?.count || '0', 10)

      // 查询昨日收集量
      const yesterdayResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM event_log
         WHERE 1 = 1 ${yesterdayCondition}`,
      )
      const yesterdayCount = parseInt(yesterdayResult[0]?.count || '0', 10)

      // 查询本周收集量
      const weekResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM event_log
         WHERE 1 = 1 ${weekCondition}`,
      )
      const weekCount = parseInt(weekResult[0]?.count || '0', 10)

      // 查询本月收集量
      const monthResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM event_log
         WHERE 1 = 1 ${monthCondition}`,
      )
      const monthCount = parseInt(monthResult[0]?.count || '0', 10)

      // 查询总事件量
      const totalResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM event_log
         WHERE 1 = 1`,
      )
      const totalCount = parseInt(totalResult[0]?.count || '0', 10)

      return {
        todayCollection: todayCount,
        yesterdayCollection: yesterdayCount,
        weekCollection: weekCount,
        monthCollection: monthCount,
        totalAmount: totalCount,
      }
    } catch (error) {
      console.error('Error fetching event collection metrics:', error)
      // 返回默认值
      return {
        todayCollection: 0,
        yesterdayCollection: 0,
        weekCollection: 0,
        monthCollection: 0,
        totalAmount: 0,
      }
    }
  }

  /**
   * 获取实时数据处理指标
   * @returns IRealTimeProcessingMetrics 实时数据处理指标
   */
  private async getRealTimeProcessingMetrics(): Promise<IRealTimeProcessingMetrics> {
    // TODO: 从ClickHouse获取处理后的数据量
    // 构建日期条件
    const todayCondition = "AND toDate(`$service_time`) = today()"
    const weekCondition = "AND toDate(`$service_time`) >= today() - 7"
    const monthCondition = "AND toDate(`$service_time`) >= today() - 30"

    try {
      // 查询今日处理量（从清洗后的表获取）
      const todayResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM final_event_log
         WHERE 1 = 1 ${todayCondition}`,
      )
      const todayCount = parseInt(todayResult[0]?.count || '0', 10)

      // 查询本周处理量
      const weekResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM final_event_log
         WHERE 1 = 1 ${weekCondition}`,
      )
      const weekCount = parseInt(weekResult[0]?.count || '0', 10)

      // 查询本月处理量
      const monthResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM final_event_log
         WHERE 1 = 1 ${monthCondition}`,
      )
      const monthCount = parseInt(monthResult[0]?.count || '0', 10)

      // 总处理量
      const totalResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM final_event_log
         WHERE 1 = 1`,
      )
      const totalCount = parseInt(totalResult[0]?.count || '0', 10)

      return {
        currentProcessing: todayCount,
        peakProcessing: Math.max(todayCount, 0), // 模拟峰值
        cumulativeProcessing: totalCount,
      }
    } catch (error) {
      console.error('Error fetching real time processing metrics:', error)
      // 返回默认值
      return {
        currentProcessing: 0,
        peakProcessing: 0,
        cumulativeProcessing: 0,
      }
    }
  }
}