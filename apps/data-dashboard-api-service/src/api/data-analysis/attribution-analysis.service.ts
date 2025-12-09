import { Injectable } from '@nestjs/common'
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"
import {
  generateAttributionAnalysisSql,
  ISqlGenerateResult,
} from "@src/api/data-analysis/AttributionAnalysisSqlBuilder"

import {
  IAttributionAnalysisReq,
  IAttributionAnalysisRes,
  IAttributionRawRow,
  IAttributionTableHeader,
  IAttributionTableRow,
} from "@probe-x/shared-types/src"

@Injectable()
export class AttributionAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
  ) {
  }

  async queryEvent(data: IAttributionAnalysisReq): Promise<IAttributionAnalysisRes> {
    // 1. 基础校验
    if (!data) throw new Error('入参不能为空')
    if (!data.attributionModel) throw new Error('归因模型不能为空')
    if (!Array.isArray(data.attributionEvent) || data.attributionEvent.length === 0) throw new Error('归因事件不能为空')

    // 2. 生成SQL（显式指定返回类型）
    const sqlResult: ISqlGenerateResult = generateAttributionAnalysisSql(data)
    const { sql, params, error, headerConfig } = sqlResult
    console.log('SQL语句：', sql)
    console.log('SQL参数：', params)
    console.log('SQL错误：', error)

    if (error) throw new Error(`SQL生成失败: ${error}`)
    if (!sql) throw new Error('生成的SQL为空')

    try {
      // 显式获取归因事件维度（兜底空数组）
      const attributionEventDimensions = headerConfig?.attributionEventDimensions || data.attributionEventDimension || []
      // 3. 执行查询（模拟数据/真实查询二选一）
      const rawRows = await this.clickhouseService.query<IAttributionRawRow[]>(sql, params)
      // const rawRows = this.getMockRawData(attributionEventDimensions)

      // 4. 构建表头配置
      const tableHeader = this.buildTableHeader(headerConfig)

      // 5. 转换为表格行数据
      const tableData = this.convertToTableRows(rawRows, attributionEventDimensions)

      // 6. 计算总计
      const total = this.calculateTotal(rawRows)

      // 7. 组装返回结果
      return {
        tableHeader,
        tableData,
        total,
        attributionModel: data.attributionModel,
        timeRange: data.timeRange,
      }
    } catch (dbError) {
      console.error('ClickHouse查询失败：', dbError)
      throw new Error(`归因分析查询失败: ${(dbError as Error).message}`)
    }
  }

  /** 构建表格表头（适配合并单元格） */
  private buildTableHeader(headerConfig?: ISqlGenerateResult['headerConfig']): IAttributionTableHeader {
    // 显式赋值+兜底
    const conversionEventName = headerConfig?.conversionEventName || '未知事件'
    const attributionEventDimensions = headerConfig?.attributionEventDimensions || []

    // 触点部分表头：归因事件名 + 所有归因维度 + 总次数 + 用户数
    const touchPointHeaders = [
      '归因事件',
      ...attributionEventDimensions.map(dim => dim.replace('$', '')), // 去掉$符号展示
      '归因事件总次数',
      '归因事件用户数',
    ]

    // 转化事件部分表头
    const conversionHeaders = ['转化指标', '转化率', '贡献度']

    return {
      firstHeader: {
        touchPoint: '触点',
        conversionEvent: `转化事件：${conversionEventName}`,
      },
      secondHeader: {
        touchPointHeaders,
        conversionHeaders,
      },
    }
  }

  /** 转换原始数据为表格行数据 */
  private convertToTableRows(rawRows: IAttributionRawRow[], attributionDimensions: string[]): IAttributionTableRow[] {
    return rawRows.map(row => {
      // 构建触点部分数据
      const touchPointData: IAttributionTableRow['touchPointData'] = {
        attributionEventName: row.attribution_event_name as string,
        total_count: row.total_count as number,
        user_count: row.user_count as number,
      }

      // 补充归因维度值（兜底未知）
      attributionDimensions.forEach(dim => {
        touchPointData[dim] = row[dim] ?? '未知'
      })

      // 构建转化事件部分数据
      const conversionData: IAttributionTableRow['conversionData'] = {
        conversionMetric: row.conversion_metric as number,
        conversionRate: row.conversion_rate as number,
        contribution: {
          rate: row.contribution_rate as number,
          progress: row.contribution_progress as number,
        },
      }

      return {
        touchPointData,
        conversionData,
      }
    })
  }

  /** 计算总计数据 */
  private calculateTotal(rawRows: IAttributionRawRow[]): IAttributionAnalysisRes['total'] {
    if (!rawRows.length) {
      return {
        totalConversionMetric: 0,
        totalConversionRate: 0,
        totalContribution: 100,
      }
    }

    // 总转化指标
    const totalConversionMetric = rawRows.reduce((sum, row) => sum + (row.conversion_metric as number), 0)
    // 平均转化率
    const avgConversionRate = rawRows.reduce((sum, row) => sum + (row.conversion_rate as number), 0) / rawRows.length
    // 总贡献度固定100%
    const totalContribution = 100

    return {
      totalConversionMetric: Number(totalConversionMetric.toFixed(2)),
      totalConversionRate: Number(avgConversionRate.toFixed(2)),
      totalContribution,
    }
  }
  /** 模拟原始查询数据（适配表格结构）- 增强版（修复forEach break问题） */
  private getMockRawData(attributionDimensions: string[]): IAttributionRawRow[] {
    // 定义真实业务场景的维度值池（可根据实际业务扩展）
    const dimensionValuePool = {
      '$device_id': ['33aaa', 'faa123', 'faa456', '232bbb', '789ccc', '99ddd', '88eee'],
      '$viewport_width': [1920, 1080, 750, 375, 1280, 828, 1440, 360],
      '$device_type': ['pc', 'mobile', 'pad', 'tv', 'unknown'],
      '$os_type': ['android', 'ios', 'windows', 'macos', 'linux'],
      '$channel': ['wechat', 'baidu', 'tiktok', 'email', 'direct', 'qq'],
      '$browser': ['chrome', 'safari', 'firefox', 'edge', 'ie', 'unknown'],
    }

    // 定义更多归因事件（覆盖常见用户行为）
    const attributionEvents = [
      'page_leave', 'page_load', 'page_view', 'click_button',
      'form_submit', 'link_click', 'video_play', 'download_file',
    ]

    // 构建基础维度对象（适配传入的维度列表，随机取值）
    const getRandomDimensionValues = (dimList: string[]) => {
      return dimList.reduce((obj, dim) => {
        // 优先从值池中取随机值，无匹配则设为"未知"
        if (dimensionValuePool[dim as keyof typeof dimensionValuePool]) {
          const values = dimensionValuePool[dim as keyof typeof dimensionValuePool]
          obj[dim] = values[Math.floor(Math.random() * values.length)]
        } else {
          obj[dim] = '未知'
        }
        return obj
      }, {} as Record<string, string | number>)
    }

    // 生成模拟数据行（每个事件生成多条数据，维度值随机）
    const mockData: IAttributionRawRow[] = []
    let totalContribution = 0 // 控制总贡献度接近100%
    let shouldStop = false // 循环终止标志位

    // 替换forEach为for循环，支持break
    for (let eventIdx = 0; eventIdx < attributionEvents.length && !shouldStop; eventIdx++) {
      const eventName = attributionEvents[eventIdx]
      // 每个事件生成2-4条数据行（模拟不同维度组合）
      const rowCount = Math.floor(Math.random() * 3) + 2

      for (let i = 0; i < rowCount && !shouldStop; i++) {
        // 生成随机维度值
        const dimensionValues = getRandomDimensionValues(attributionDimensions)

        // 生成符合业务逻辑的随机数值
        const totalCount = Math.floor(Math.random() * 800) + 100 // 100-900
        const userCount = Math.floor(totalCount * (Math.random() * 0.7 + 0.2)) // 20%-90%的用户数
        const conversionMetric = Math.floor(Math.random() * 200) + 10 // 10-210
        const conversionRate = Number((Math.random() * 30 + 5).toFixed(1)) // 5%-35%

        // 控制贡献度总和接近100%
        let contributionRate = Number((Math.random() * 15 + 1).toFixed(2))
        if (totalContribution + contributionRate > 100) {
          contributionRate = Number((100 - totalContribution).toFixed(2))
        }
        totalContribution += contributionRate

        mockData.push({
          attribution_event_name: eventName,
          ...dimensionValues,
          total_count: totalCount,
          user_count: userCount,
          conversion_metric: conversionMetric,
          conversion_rate: conversionRate,
          contribution_rate: contributionRate,
          contribution_progress: contributionRate, // 进度条值与贡献度百分比一致
        })

        // 总贡献度达到100%则停止生成
        if (totalContribution >= 100) {
          shouldStop = true // 设置终止标志
          break // 跳出当前事件的行循环
        }
      }
    }

    // 确保总贡献度正好100%（最后一行调整）
    if (mockData.length > 0 && totalContribution < 100) {
      const lastRow = mockData[mockData.length - 1]
      lastRow.contribution_rate = Number((100 - (totalContribution - lastRow.contribution_rate)).toFixed(2))
      lastRow.contribution_progress = lastRow.contribution_rate
    }

    return mockData
  }
}
