import { Injectable } from '@nestjs/common'
import {
  GenericEventAnalysisResult,
  IFreeAnalysisReq,
  IUser,
} from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"
import { generateEventAnalysisSql } from "@src/api/data-analysis/EventAnalysisSqlBuilder"

@Injectable()
export class FreeAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
  ) {
  }

  /**
   * 自由分析查询
   * 复用 EventAnalysisSqlBuilder 的 SQL 生成能力，支持更灵活的维度组合
   */
  async queryFree(data: IFreeAnalysisReq, user: IUser): Promise<GenericEventAnalysisResult[]> {
    // 拼接SQL语句（复用事件分析的 SQL 生成器）
    const { sql, params, error } = generateEventAnalysisSql(data)

    // 检查SQL生成错误
    if (error) {
      throw new BusinessException(error)
    }

    // 检查SQL是否为空
    if (!sql || sql.trim() === '') {
      throw new BusinessException('生成的SQL语句为空')
    }

    const result = await this.clickhouseService.query<GenericEventAnalysisResult | GenericEventAnalysisResult[]>(sql, params)

    // ClickHouse返回的result.json()应该是一个数组（JSONEachRow格式）
    if (!result) {
      return []
    }
    // 确保返回数组格式
    if (Array.isArray(result)) {
      return result
    }
    return [result as GenericEventAnalysisResult]
  }
}
