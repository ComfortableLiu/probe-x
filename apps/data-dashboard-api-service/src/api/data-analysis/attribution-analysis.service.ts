import { Injectable } from '@nestjs/common'
import { IAttributionAnalysisReq, IAttributionAnalysisRes, IAttributionDimensionNode } from "@probe-x/shared-types/src"
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"
import { generateAttributionAnalysisSql } from "@src/api/data-analysis/AttributionAnalysisSqlBuilder"

/**
 * ClickHouse查询返回的原始行数据类型（与SQL字段严格对应）
 */
interface IAttributionRawRow {
  // 动态维度字段（兼容任意维度名）
  [key: string]: string | number | null;
  // 固定指标字段
  conversion_value: number;       // 转化值
  contribution_rate: number;      // 贡献率（百分比）
  conversion_rate: number;        // 转化率（百分比）
  total_metric_value: number;     // 指标总计值
}

@Injectable()
export class AttributionAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
  ) {
  }

  async queryEvent(data: IAttributionAnalysisReq): Promise<IAttributionAnalysisRes> {
    // 1. 生成SQL和参数
    const { sql, params, error } = generateAttributionAnalysisSql(data)
    console.log('SQL语句：', sql)
    console.log('SQL参数：', params)
    console.log('SQL错误：', error)

    // 校验SQL生成结果
    if (error) {
      throw new Error(`SQL生成失败: ${error}`)
    }
    if (!sql) {
      throw new Error('生成的SQL为空')
    }

    try {
      // 2. 执行ClickHouse查询（泛型指定为原始行数据数组）
      const rawRows = await this.clickhouseService.query<IAttributionRawRow>(sql, params)
      console.log('原始查询结果：', rawRows)

      // 3. 计算总计数据
      const totalData = this.calculateTotal(rawRows)

      // 4. 构建维度层级树（处理循环、去重）
      const dimensionTree = this.buildDimensionTree(rawRows, data.dimension)

      // 5. 组装最终返回结果
      return {
        data: dimensionTree,
        total: totalData,
        dimensions: data.dimension,
        attributionModel: data.attributionModel,
      }
    } catch (dbError) {
      console.error('ClickHouse查询失败：', dbError)
      throw new Error(`归因分析查询失败: ${(dbError as Error).message}`)
    }
  }

  /**
   * 计算总计数据
   */
  private calculateTotal(
    rawRows: IAttributionRawRow[],
  ): IAttributionAnalysisRes['total'] {
    // 总转化值：所有行转化值之和
    const totalConversionValue = rawRows.reduce((sum, row) => sum + (row.conversion_value || 0), 0)

    // 总指标值：取第一行的total_metric_value（所有行该值一致）
    const totalMetricValue = rawRows[0]?.total_metric_value || 0

    // 整体转化率：总转化值 / 总指标值 * 100
    const conversionRate = totalMetricValue > 0
      ? (totalConversionValue / totalMetricValue) * 100
      : 0

    return {
      conversionValue: totalConversionValue,
      totalContributionRate: 100, // 所有维度贡献率之和为100%
      conversionRate: Number(conversionRate.toFixed(2)), // 保留2位小数
    }
  }

  /**
   * 构建维度层级树（处理循环引用、去重）
   */
  private buildDimensionTree(
    rawRows: IAttributionRawRow[],
    dimensions: string[],
  ): IAttributionDimensionNode[] {
    // 空数据处理
    if (rawRows.length === 0 || dimensions.length === 0) {
      return []
    }

    // 用于去重的唯一键生成器
    const generateNodeKey = (dimensionName: string, dimensionValue: string | number | null) =>
      `${dimensionName}_${dimensionValue || 'null'}`

    // 根节点数组
    const rootNodes: IAttributionDimensionNode[] = []
    // 节点缓存（防止循环引用、重复创建）
    const nodeCache = new Map<string, IAttributionDimensionNode>()

    // 遍历每一行原始数据，构建层级
    rawRows.forEach(row => {
      let currentLevelNodes = rootNodes
      let parentKey = ''

      // 按维度层级递归创建节点
      dimensions.forEach(dimName => {
        const dimValue = row[dimName]
        // 生成唯一键（包含层级，防止跨层级重复）
        const nodeKey = `${parentKey}_${generateNodeKey(dimName, dimValue)}`

        // 检查缓存，避免重复创建和循环引用
        if (nodeCache.has(nodeKey)) {
          // 已存在的节点，直接进入下一级
          const existingNode = nodeCache.get(nodeKey)!
          currentLevelNodes = existingNode.children || []
          parentKey = nodeKey
          return
        }

        // 创建新节点
        const newNode: IAttributionDimensionNode = {
          dimensionName: dimName,
          dimensionValue: dimValue?.toString() || '未知', // 统一转为字符串
          children: [],
          conversionValue: Number((row.conversion_value || 0).toFixed(2)),
          contributionRate: Number((row.contribution_rate || 0).toFixed(2)),
          conversionRate: Number((row.conversion_rate || 0).toFixed(2)),
        }

        // 添加到当前层级
        currentLevelNodes.push(newNode)
        // 加入缓存
        nodeCache.set(nodeKey, newNode)
        // 进入下一级
        currentLevelNodes = newNode.children
        parentKey = nodeKey
      })
    })

    return rootNodes
  }
}
