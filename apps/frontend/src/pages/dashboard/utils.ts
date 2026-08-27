import dayjs from "dayjs"
import queryString from "query-string"
import type { EChartsOption } from "echarts"
import type { TableProps } from "antd"
import { AnalysisType } from "@probe-x/shared-types/src"
import type {
  GenericEventAnalysisResult,
  IAttributionAnalysisRes,
  IDashboard,
  IDashboardConfig,
  IDashboardDataRes,
  IFunnelAnalysisRes,
  IUserPathAnalysisRes,
} from "@probe-x/shared-types/src"

// 分析类型中文名映射
export const ANALYSIS_TYPE_TEXT: Record<AnalysisType, string> = {
  [AnalysisType.EVENT]: '事件分析',
  [AnalysisType.FUNNEL]: '漏斗分析',
  [AnalysisType.USER_PATH]: '用户路径分析',
  [AnalysisType.ATTRIBUTION]: '归因分析',
}

export interface IDashboardTableData {
  columns: TableProps['columns']
  dataSource: Record<string, unknown>[]
}

// 生成日期列表（YYYY-MM-DD），与事件分析 SQL 的日期别名规则配套
function buildDateList(timeRange?: [string, string]): string[] {
  if (!timeRange?.[0] || !timeRange?.[1]) return []
  const dates: string[] = []
  for (let i = dayjs(timeRange[0]); i.isBefore(dayjs(timeRange[1])) || i.isSame(dayjs(timeRange[1])); i = i.add(1, 'day')) {
    dates.push(i.format('YYYY-MM-DD'))
  }
  return dates
}

// 事件别名规则与 EventAnalysisSqlBuilder 的 getEventAlias/getEventDateAlias 保持一致
function buildEventAliases(eventInfoList: { eventName?: string }[]) {
  return eventInfoList.map((info, index) => ({
    alias: `event_${index}_${info.eventName?.replace(/\W+/g, '_') || 'unknown'}`,
    name: info.eventName || 'unknown_event',
  }))
}

// 分母为 0 或结果非有限值时按 0 处理，避免出现 NaN%/Infinity%
function calcConversionRate(value?: number, base?: number): number | undefined {
  if (value === undefined || base === undefined) return undefined
  if (!base) return 0
  const rate = value / base
  return Number.isFinite(rate) ? rate : 0
}

/**
 * 事件分析：折线图
 * timeRange 为页面生效的时间范围（全局/卡片单独设置），缺省时回退到看板保存的配置
 */
function buildEventChartOption(
  dashboard: IDashboard,
  data: GenericEventAnalysisResult[],
  timeRange?: [string, string],
): EChartsOption | null {
  const config = dashboard.config?.eventAnalysis
  const eventInfoList = config?.eventInfoList || []
  const dateList = buildDateList(timeRange || config?.timeRange)
  if (!data?.length || !eventInfoList.length || !dateList.length) return null

  const eventAliases = buildEventAliases(eventInfoList)

  // 按事件分组，聚合所有维度行的同一事件-日期指标
  const series = eventAliases.map(({ alias, name }) => ({
    name,
    type: 'line' as const,
    smooth: true,
    data: dateList.map((date) => {
      const metricKey = `${alias}_${date.replace(/-/g, '_')}`
      return data.reduce((sum, row) => sum + (Number(row[metricKey]) || 0), 0)
    }),
  }))

  return {
    xAxis: {
      type: 'category',
      data: dateList,
      axisLabel: {
        rotate: dateList.length > 10 ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
    },
    series,
    legend: {
      data: eventAliases.map(item => item.name),
      top: 0,
    },
    tooltip: {
      trigger: 'axis',
    },
  }
}

/**
 * 漏斗分析：漏斗图
 */
function buildFunnelChartOption(dashboard: IDashboard, data: IFunnelAnalysisRes): EChartsOption | null {
  const funnelInfoList = dashboard.config?.funnelAnalysis?.funnelInfoList || []
  if (!data?.length || !funnelInfoList.length) return null

  // 步骤字段名与后端生成规则一致：优先 stepName，为空时回退 step_{n}_value
  const stepKey = (index: number) => funnelInfoList[index].stepName || `step_${index + 1}_value`
  const chartData = funnelInfoList.map((item, index) => ({
    name: stepKey(index),
    value: Number(data[0][stepKey(index)]) || 0,
  }))

  return {
    tooltip: {
      trigger: 'item',
    },
    series: [
      {
        name: '转化率',
        type: 'funnel',
        left: '10%',
        top: 20,
        bottom: 20,
        width: '80%',
        min: 0,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: {
          show: true,
          position: 'inside',
        },
        data: chartData,
      },
    ],
  }
}

/**
 * 用户路径分析：桑基图
 */
function buildUserPathChartOption(data: IUserPathAnalysisRes): EChartsOption | null {
  if (!data?.eventList?.length || !data?.edgeList?.length) return null

  // 统计每个节点的总流量（流出次数总和）
  const nodeTotalMap = new Map<string, number>()
  data.edgeList.forEach((link) => {
    if (!link.source || link.value <= 0) return
    nodeTotalMap.set(link.source, (nodeTotalMap.get(link.source) || 0) + link.value)
  })

  const nodes = data.eventList.map(event => ({
    name: event,
    totalValue: nodeTotalMap.get(event) || 0,
  }))
  // 过滤流量过小的边，避免看板小卡片里线条过于密集
  const links = data.edgeList.filter(link => link.value >= 5)
  if (!links.length) return null

  return {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (params: any) => {
        const getOriginalName = (name: string) => name.replace(/_\d+$/, '')
        if (params.dataType === 'link') {
          return `源事件：${getOriginalName(params.sourceName)}<br/>目标事件：${getOriginalName(params.targetName)}<br/>流转次数：${params.value}`
        }
        return `事件：${getOriginalName(params.name)}<br/>总流出次数：${params.data.totalValue || 0}`
      },
    },
    animation: false,
    series: [
      {
        type: 'sankey',
        emphasis: {
          focus: 'adjacency',
        },
        nodeAlign: 'right',
        roam: true,
        nodeWidth: 80,
        nodeGap: 15,
        data: nodes,
        links,
        lineStyle: {
          color: 'source',
          curveness: 0.4,
          opacity: 0.7,
        },
        label: {
          position: 'inside',
          align: 'center',
          verticalAlign: 'middle',
          fontSize: 10,
          formatter: (params: any) => (params.name as string).replace(/_\d+$/, ''),
        },
      },
    ],
  }
}

/**
 * 归因分析：各触点事件贡献度柱状图
 */
function buildAttributionChartOption(data: IAttributionAnalysisRes): EChartsOption | null {
  if (!data?.tableData?.length) return null

  const rows = data.tableData

  return {
    xAxis: {
      type: 'category',
      data: rows.map(row => row.touchPointData.attributionEventName),
      axisLabel: {
        rotate: rows.length > 6 ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}%',
      },
    },
    series: [
      {
        name: '贡献度',
        type: 'bar',
        barMaxWidth: 40,
        data: rows.map(row => row.conversionData.contribution.rate),
      },
    ],
    tooltip: {
      trigger: 'axis',
      valueFormatter: value => `${value}%`,
    },
  }
}

/**
 * 根据看板分析类型构建图表配置
 */
export function buildChartOption(
  dashboard: IDashboard,
  res?: IDashboardDataRes,
  timeRange?: [string, string],
): EChartsOption | null {
  if (!res?.data) return null
  switch (dashboard.analysisType) {
    case AnalysisType.EVENT:
      return buildEventChartOption(dashboard, res.data, timeRange)
    case AnalysisType.FUNNEL:
      return buildFunnelChartOption(dashboard, res.data)
    case AnalysisType.USER_PATH:
      return buildUserPathChartOption(res.data)
    case AnalysisType.ATTRIBUTION:
      return buildAttributionChartOption(res.data)
    default:
      return null
  }
}

/**
 * 事件分析表格：维度 + 事件 + 日期列（看板卡片内简化渲染，不做单元格合并）
 */
function buildEventTableData(
  dashboard: IDashboard,
  data: GenericEventAnalysisResult[],
  timeRange?: [string, string],
): IDashboardTableData | null {
  const config = dashboard.config?.eventAnalysis
  const eventInfoList = config?.eventInfoList || []
  const dateList = buildDateList(timeRange || config?.timeRange)
  if (!data?.length || !eventInfoList.length || !dateList.length) return null

  // 「总体」维度在参数中是空字符串，渲染列时需要过滤掉
  const validDimension = (config?.dimension || []).filter(item => typeof item === 'string' && item.trim())
  const eventAliases = buildEventAliases(eventInfoList)

  // 每个原始行（维度组合）拆成 N 个事件行
  const dataSource: Record<string, unknown>[] = []
  data.forEach((rawRow, rowIndex) => {
    eventAliases.forEach(({ alias, name }, eventIndex) => {
      const tableRow: Record<string, unknown> = {
        key: `${rowIndex}_${eventIndex}`,
        eventName: name,
      }
      validDimension.forEach((dimKey) => {
        tableRow[dimKey] = rawRow[dimKey]
      })
      dateList.forEach((date) => {
        const metricKey = `${alias}_${date.replace(/-/g, '_')}`
        tableRow[date] = rawRow[metricKey] || 0
      })
      dataSource.push(tableRow)
    })
  })

  const columns: TableProps['columns'] = [
    ...validDimension.map(dimKey => ({
      title: dimKey,
      dataIndex: dimKey,
      width: 120,
    })),
    {
      title: '事件名称',
      dataIndex: 'eventName',
      width: 150,
    },
    ...dateList.map(date => ({
      title: date,
      dataIndex: date,
      width: 110,
    })),
  ]

  return { columns, dataSource }
}

/**
 * 漏斗分析表格：步骤 / 数值 / 单步转化率
 */
function buildFunnelTableData(dashboard: IDashboard, data: IFunnelAnalysisRes): IDashboardTableData | null {
  const funnelInfoList = dashboard.config?.funnelAnalysis?.funnelInfoList || []
  if (!data?.length || !funnelInfoList.length) return null

  const stepKey = (index: number) => funnelInfoList[index].stepName || `step_${index + 1}_value`
  const dataSource = funnelInfoList.map((item, index) => {
    const isFirst = index === 0
    const value = Number(data[0][stepKey(index)]) || 0
    const prevValue = isFirst ? undefined : Number(data[0][stepKey(index - 1)]) || 0
    const conversionRate = isFirst ? undefined : calcConversionRate(value, prevValue)
    return {
      key: stepKey(index),
      stepName: stepKey(index),
      value,
      conversionRate: conversionRate === undefined ? '--' : `${(conversionRate * 100).toFixed(2)}%`,
    }
  })

  const columns: TableProps['columns'] = [
    {
      title: '步骤',
      dataIndex: 'stepName',
    },
    {
      title: '数值',
      dataIndex: 'value',
      width: 120,
    },
    {
      title: '单步转化率',
      dataIndex: 'conversionRate',
      width: 120,
    },
  ]

  return { columns, dataSource }
}

/**
 * 归因分析表格：tableData 的扁平列渲染
 */
function buildAttributionTableData(data: IAttributionAnalysisRes): IDashboardTableData | null {
  if (!data?.tableData?.length) return null

  const dataSource = data.tableData.map((row, index) => ({
    key: index,
    attributionEventName: row.touchPointData.attributionEventName,
    totalCount: row.touchPointData.total_count,
    userCount: row.touchPointData.user_count,
    conversionMetric: row.conversionData.conversionMetric,
    conversionRate: `${row.conversionData.conversionRate}%`,
    contributionRate: `${row.conversionData.contribution.rate}%`,
  }))

  const columns: TableProps['columns'] = [
    {
      title: '归因事件',
      dataIndex: 'attributionEventName',
    },
    {
      title: '总次数',
      dataIndex: 'totalCount',
      width: 100,
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      width: 100,
    },
    {
      title: '转化指标',
      dataIndex: 'conversionMetric',
      width: 100,
    },
    {
      title: '转化率',
      dataIndex: 'conversionRate',
      width: 100,
    },
    {
      title: '贡献度',
      dataIndex: 'contributionRate',
      width: 100,
    },
  ]

  return { columns, dataSource }
}

/**
 * 用户路径分析表格：路径行（源事件 / 目标事件 / 流转次数）
 */
function buildUserPathTableData(data: IUserPathAnalysisRes): IDashboardTableData | null {
  if (!data?.edgeList?.length) return null

  const dataSource = [...data.edgeList]
    .sort((a, b) => b.value - a.value)
    .map((link, index) => ({
      key: index,
      source: link.source.replace(/_\d+$/, ''),
      target: link.target.replace(/_\d+$/, ''),
      value: link.value,
    }))

  const columns: TableProps['columns'] = [
    {
      title: '源事件',
      dataIndex: 'source',
    },
    {
      title: '目标事件',
      dataIndex: 'target',
    },
    {
      title: '流转次数',
      dataIndex: 'value',
      width: 100,
    },
  ]

  return { columns, dataSource }
}

/**
 * 根据看板分析类型构建表格行列数据
 */
export function buildTableData(
  dashboard: IDashboard,
  res?: IDashboardDataRes,
  timeRange?: [string, string],
): IDashboardTableData | null {
  if (!res?.data) return null
  switch (dashboard.analysisType) {
    case AnalysisType.EVENT:
      return buildEventTableData(dashboard, res.data, timeRange)
    case AnalysisType.FUNNEL:
      return buildFunnelTableData(dashboard, res.data)
    case AnalysisType.USER_PATH:
      return buildUserPathTableData(res.data)
    case AnalysisType.ATTRIBUTION:
      return buildAttributionTableData(res.data)
    default:
      return null
  }
}


// 分析类型对应的 config 字段名
const ANALYSIS_CONFIG_KEY: Record<AnalysisType, keyof IDashboardConfig> = {
  [AnalysisType.EVENT]: 'eventAnalysis',
  [AnalysisType.FUNNEL]: 'funnelAnalysis',
  [AnalysisType.USER_PATH]: 'userPathAnalysis',
  [AnalysisType.ATTRIBUTION]: 'attributionAnalysis',
}

// 分析类型对应的详情页路由
const ANALYSIS_DETAIL_ROUTE: Record<AnalysisType, string> = {
  [AnalysisType.EVENT]: '/data-analysis/event',
  [AnalysisType.FUNNEL]: '/data-analysis/funnel',
  [AnalysisType.USER_PATH]: '/data-analysis/userPath',
  [AnalysisType.ATTRIBUTION]: '/data-analysis/attribution',
}

/**
 * 构建看板对应的分析详情页 URL
 * 把看板 config 里的分析参数序列化成 URL query 并带上 dashboardId，
 * 与 dashboard-config 页的编辑跳转逻辑保持一致
 */
export function buildDetailUrl(dashboard: IDashboard): string | null {
  const route = ANALYSIS_DETAIL_ROUTE[dashboard.analysisType]
  const queryParams = dashboard.config?.[ANALYSIS_CONFIG_KEY[dashboard.analysisType]] as Record<string, unknown> | undefined
  if (!route || !queryParams || !Object.keys(queryParams).length) return null

  // 对象参数序列化为 JSON 字符串，与 useRouter 的 refresh 方法解析方式一致
  const obj: Record<string, unknown> = {}
  Object.keys(queryParams).forEach((key) => {
    const value = queryParams[key]
    obj[key] = typeof value === 'object' && value !== null ? JSON.stringify(value) : value
  })
  obj.dashboardId = dashboard.id

  return `${route}?${queryString.stringify(obj)}`
}
