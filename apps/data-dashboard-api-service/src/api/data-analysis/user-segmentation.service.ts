import { Inject, Injectable } from '@nestjs/common'
import {
  ISegmentCreateReq,
  ISegmentQueryReq,
  ISegmentQueryRes,
  ISegmentStats,
  IUser,
} from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { v4 as uuidv4 } from "uuid"
import { generateSegmentSQL } from "@src/api/data-analysis/UserSegmentationSqlBuilder"
import { DataAnalysisRecordService } from "./record.service"

/**
 * 分群结果缓存Key前缀
 */
const SEGMENT_CACHE_KEY = process.env.NODE_ENV + ':data-dashboard-api-service:segment:'

/**
 * 分群结果缓存过期时间（秒）
 */
const SEGMENT_CACHE_TTL = 3600 // 1小时

@Injectable()
export class UserSegmentationService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @Inject(DataAnalysisRecordService) private readonly dataAnalysisRecordService: DataAnalysisRecordService,
  ) {
  }

  /**
   * 创建分群规则并计算分群用户
   */
  async createSegment(data: ISegmentCreateReq, user: IUser): Promise<ISegmentStats> {
    const segmentId = uuidv4()

    // 生成SQL
    const { sql, params, error } = generateSegmentSQL(data)

    if (error) {
      throw new BusinessException(error)
    }

    if (!sql || sql.trim() === '') {
      throw new BusinessException('生成的SQL语句为空')
    }

    // 执行查询获取分群用户
    const result = await this.clickhouseService.query<any>(sql, params)

    const users = result ? result.map((row: any) => row.user_id) : []
    const totalUsers = result && result.length > 0 ? Number(result[0].total_count) : 0

    // 构建分群统计信息
    const now = new Date().toISOString()
    const stats: ISegmentStats = {
      segmentId,
      name: data.name,
      description: data.description,
      totalUsers,
      createdAt: now,
      updatedAt: now,
    }

    // 缓存分群结果
    await this.cacheSegmentResult(segmentId, {
      stats,
      users,
    })

    // 记录创建日志
    await this.dataAnalysisRecordService.recordTask(segmentId, '用户分群创建', user, JSON.stringify(data))

    return stats
  }

  /**
   * 查询分群用户列表
   */
  async querySegment(data: ISegmentQueryReq, user: IUser): Promise<ISegmentQueryRes> {
    const { segmentId, page = 1, pageSize = 50 } = data

    // 从缓存获取分群结果
    const cachedResult = await this.getCachedSegmentResult(segmentId)

    if (!cachedResult) {
      throw new BusinessException('分群不存在或已过期')
    }

    const { stats, users } = cachedResult

    // 分页处理
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paginatedUsers = users.slice(start, end)

    return {
      stats,
      users: paginatedUsers,
      total: users.length,
      page,
      pageSize,
    }
  }

  /**
   * 导出分群用户列表
   */
  async exportSegment(segmentId: string, user: IUser): Promise<{ users: string[]; total: number }> {
    // 从缓存获取分群结果
    const cachedResult = await this.getCachedSegmentResult(segmentId)

    if (!cachedResult) {
      throw new BusinessException('分群不存在或已过期')
    }

    // 记录导出日志
    await this.dataAnalysisRecordService.recordExport(user, 'csv', '用户分群导出', { segmentId })

    return {
      users: cachedResult.users,
      total: cachedResult.users.length,
    }
  }

  /**
   * 获取分群统计信息
   */
  async getSegmentStats(segmentId: string): Promise<ISegmentStats> {
    const cachedResult = await this.getCachedSegmentResult(segmentId)

    if (!cachedResult) {
      throw new BusinessException('分群不存在或已过期')
    }

    return cachedResult.stats
  }

  /**
   * 缓存分群结果
   */
  private async cacheSegmentResult(segmentId: string, data: { stats: ISegmentStats; users: string[] }): Promise<void> {
    await this.redisService.set(SEGMENT_CACHE_KEY + segmentId, data, SEGMENT_CACHE_TTL)
  }

  /**
   * 获取缓存的分群结果
   */
  private async getCachedSegmentResult(segmentId: string): Promise<{ stats: ISegmentStats; users: string[] } | null> {
    return await this.redisService.get<{ stats: ISegmentStats; users: string[] }>(SEGMENT_CACHE_KEY + segmentId)
  }
}
