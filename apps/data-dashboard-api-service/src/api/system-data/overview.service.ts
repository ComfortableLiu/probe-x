import { ServiceResourcesService } from './service-resources.service'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ClickHouseService, DataAnalysisQueryStatsEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import {
  IAnalysisQueryMetrics,
  IComputingNodeStatus,
  IEventCollectionMetrics,
  ISystemDataOverviewResponse,
} from '@probe-x/shared-types/src'
import { metricsWindow } from '@probe-x/shared-utils/src/lib/backend-common/runtime-metrics'
import { NodeRegistryService } from '../compute-node/node-registry.service'
import { RuntimeMetricsService } from './runtime-metrics.service'

@Injectable()
export class OverviewService {
  private readonly logger = new Logger(OverviewService.name)
  private pending: Promise<ISystemDataOverviewResponse> | null = null
  private cached: { at: number; data: ISystemDataOverviewResponse } | null = null

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly nodeRegistry: NodeRegistryService,
    private readonly runtimeMetrics: RuntimeMetricsService,
    @InjectRepository(DataAnalysisQueryStatsEntity)
    private readonly queryStats: Repository<DataAnalysisQueryStatsEntity>,
    private readonly serviceResources: ServiceResourcesService,
  ) {}

  getSystemDataOverview(): Promise<ISystemDataOverviewResponse> {
    if (this.cached && Date.now() - this.cached.at < 15000) return Promise.resolve(this.cached.data)
    if (this.pending) return this.pending
    this.pending = this.loadOverview().then(data => {
      this.cached = { at: Date.now(), data }
      return data
    }).finally(() => { this.pending = null })
    return this.pending
  }

  private async loadOverview(): Promise<ISystemDataOverviewResponse> {
    const now = Date.now()
    const warnings: string[] = []
    const read = async <T>(label: string, query: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await query()
      } catch (error) {
        this.logger.warn(`${label}读取失败: ${error instanceof Error ? error.message : String(error)}`)
        warnings.push(`${label}暂不可用`)
        return fallback
      }
    }
    const [computingNodeStatus, systemPerformanceMetrics, eventCollectionMetrics, analysisQueryMetrics, processing, finalCount, serviceResources] = await Promise.all([
      read('计算节点', () => this.getComputingNodeStatus(), {
        totalNodes: null, onlineNodes: null, offlineNodes: null, onlineRate: null,
        cpuUsage: null, memoryUsage: null, avgLoad: null, networkTraffic: null,
      }),
      read('API 性能采样', () => this.runtimeMetrics.getPerformance(now), {
        currentQps: null, peakQps: null, avgQps: null, avgResponseTime: null,
        p95ResponseTime: null, p99ResponseTime: null, systemAvailability: null,
        currentMonthAvailability: null, requestErrorRate: null, systemErrorRate: null, businessErrorRate: null,
      }),
      read('事件收集量', () => this.getEventCollectionMetrics(now), {
        todayCollection: null, yesterdayCollection: null, weekCollection: null, monthCollection: null, totalAmount: null,
      }),
      read('数分查询量', () => this.getAnalysisQueryMetrics(now), {
        todayQueries: null, yesterdayQueries: null, weekQueries: null, monthQueries: null,
      }),
      read('处理吞吐采样', () => this.runtimeMetrics.getProcessing(now), { currentProcessing: null, peakProcessing: null, finalCleaningSuccessRate: null }),
      read<number | null>('清洗后事件量', async () => {
        const rows = await this.clickhouseService.query<{ count: string }>('SELECT toString(count()) AS count FROM final_event_log')
        return Number(rows[0]?.count || 0)
      }, null),
      read('服务资源', () => this.serviceResources.getResources(now), []),
    ])
    return {
      serviceResources,
      computingNodeStatus,
      systemPerformanceMetrics,
      eventCollectionMetrics,
      analysisQueryMetrics,
      realTimeProcessingMetrics: { currentProcessing: processing.currentProcessing, peakProcessing: processing.peakProcessing, cumulativeProcessing: finalCount },
      metaOverview: {
        originalDataTotal: eventCollectionMetrics.totalAmount === null ? '—' : String(eventCollectionMetrics.totalAmount),
        finalCleanedData: finalCount === null ? '—' : String(finalCount),
        // 成功率来自今日任务结果采样，不能以不同 TTL 的表存量相除。
        firstCleaningSuccessRate: null,
        finalCleaningSuccessRate: processing.finalCleaningSuccessRate,
      },
      updatedAt: new Date(now).toISOString(),
      warnings,
    }
  }

  private async getComputingNodeStatus(): Promise<IComputingNodeStatus> {
    const { nodes } = await this.nodeRegistry.getTopology()
    const online = nodes.filter(node => node.link === 'connected')
    const cpu = online.filter(node => node.cpuUsage !== null && node.cpuUsage !== undefined && node.cpuCount > 0)
    const memory = online.filter(node => node.memorySize > 0)
    const loads = online.filter(node => node.loadAverage !== null && node.loadAverage !== undefined)
    const network = online.filter(node => node.networkBytesPerSecond !== null && node.networkBytesPerSecond !== undefined)
    const cpuCount = cpu.reduce((sum, node) => sum + node.cpuCount, 0)
    const memorySize = memory.reduce((sum, node) => sum + node.memorySize, 0)
    return {
      totalNodes: nodes.length,
      onlineNodes: online.length,
      offlineNodes: nodes.length - online.length,
      onlineRate: nodes.length ? online.length / nodes.length * 100 : null,
      // Do not pass off a partially upgraded cluster's resource metrics as the whole cluster.
      cpuUsage: cpu.length === online.length && cpuCount ? cpu.reduce((sum, node) => sum + node.cpuUsage * node.cpuCount, 0) / cpuCount : null,
      memoryUsage: memory.length === online.length && memorySize
        ? memory.reduce((sum, node) => sum + Math.max(0, node.memorySize - node.availableMemorySize), 0) / memorySize * 100 : null,
      avgLoad: loads.length === online.length && loads.length ? loads.reduce((sum, node) => sum + node.loadAverage, 0) / loads.length : null,
      networkTraffic: network.length === online.length && network.length
        ? network.reduce((sum, node) => sum + node.networkBytesPerSecond, 0) * 8 / 1e9 : null,
    }
  }

  private async getEventCollectionMetrics(now: number): Promise<IEventCollectionMetrics> {
    const { today, yesterday, tomorrow, weekStart, monthStart } = metricsWindow(now)
    const [row] = await this.clickhouseService.query<Record<string, string>>(`
      SELECT count() AS totalAmount,
        countIf(day = {today:Date}) AS todayCollection,
        countIf(day = {yesterday:Date}) AS yesterdayCollection,
        countIf(day >= {weekStart:Date} AND day < {tomorrow:Date}) AS weekCollection,
        countIf(day >= {monthStart:Date} AND day < {tomorrow:Date}) AS monthCollection
      FROM (SELECT toDate(\`$service_time\`, 'Asia/Shanghai') AS day FROM event_log)
    `, { today, yesterday, tomorrow, weekStart, monthStart })
    return {
      todayCollection: Number(row?.todayCollection || 0),
      yesterdayCollection: Number(row?.yesterdayCollection || 0),
      weekCollection: Number(row?.weekCollection || 0),
      monthCollection: Number(row?.monthCollection || 0),
      totalAmount: Number(row?.totalAmount || 0),
    }
  }

  private async getAnalysisQueryMetrics(now: number): Promise<IAnalysisQueryMetrics> {
    const { today, yesterday, tomorrow, weekStart, monthStart } = metricsWindow(now)
    // query_date is indexed and populated by the real analysis execution record service.
    const row = await this.queryStats.createQueryBuilder('stats')
      .select('COALESCE(SUM(stats.query_date = :today), 0)', 'todayQueries')
      .addSelect('COALESCE(SUM(stats.query_date = :yesterday), 0)', 'yesterdayQueries')
      .addSelect('COALESCE(SUM(stats.query_date >= :weekStart), 0)', 'weekQueries')
      .addSelect('COALESCE(SUM(stats.query_date >= :monthStart), 0)', 'monthQueries')
      .where('stats.query_date >= :start AND stats.query_date < :tomorrow', {
        start: [yesterday, weekStart, monthStart].sort()[0], today, yesterday, tomorrow, weekStart, monthStart,
      })
      .getRawOne()
    return {
      todayQueries: Number(row?.todayQueries || 0),
      yesterdayQueries: Number(row?.yesterdayQueries || 0),
      weekQueries: Number(row?.weekQueries || 0),
      monthQueries: Number(row?.monthQueries || 0),
    }
  }
}
