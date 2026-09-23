import React, { memo, useMemo } from "react"
import type { EChartsOption, SeriesOption } from "echarts"
import ChartContainer from "@components/ChartContainer"
import { useModel } from "@/hooks"
import { utmMetricDateAlias } from "@probe-x/shared-types/src"
import { IDataAnalysisUtmState } from "@pages/data-analysis/utm/type"
import { buildDateList, buildUtmAliasMap, formatUtmRowName } from "@pages/data-analysis/utm/utils"

// 趋势图里最多画多少条分组线，再多了没法看
const TOP_N = 10

/**
 * UTM 分析趋势图
 *
 * 纵轴取第一个选中指标的按天值。系列 = 合计 + 取值量最大的前 N 个分组。
 * 合计线用 summary 的按天列，不能拿分组行相加 —— 用户数/会话数是 uniq 口径
 */
function UtmTrendChart() {

  const {
    data,
    querySnapshot,
    utmOptions,
  } = useModel<IDataAnalysisUtmState>('dataAnalysisUtmModel')

  const aliasMap = useMemo(() => buildUtmAliasMap(utmOptions), [utmOptions])

  const dimensions = useMemo(() => querySnapshot?.dimensions || [], [querySnapshot])
  const metric = querySnapshot?.metrics?.[0]
  const dateList = useMemo(() => buildDateList(querySnapshot?.timeRange), [querySnapshot])

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!metric || !dateList.length || !data) return null

    const rows = data.rows || []
    const summary = data.summary
    const hasSummary = !!summary && Object.keys(summary).length > 0
    if (!rows.length && !hasSummary) return null

    const seriesList: SeriesOption[] = []

    if (hasSummary) {
      seriesList.push({
        name: '合计',
        type: 'line',
        smooth: true,
        data: dateList.map(date => Number(summary[utmMetricDateAlias(metric, date)]) || 0),
      })
    }

    rows.slice(0, TOP_N).forEach(row => {
      seriesList.push({
        name: formatUtmRowName(dimensions, row, aliasMap) || '未命名',
        type: 'line',
        smooth: true,
        data: dateList.map(date => Number(row[utmMetricDateAlias(metric, date)]) || 0),
      })
    })

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
      series: seriesList,
      legend: {
        data: seriesList.map(item => item.name as string),
        top: 0,
        type: 'scroll',
      },
      tooltip: {
        trigger: 'axis',
      },
    }
  }, [data, dimensions, metric, dateList, aliasMap])

  return (
    <ChartContainer
      option={chartOption}
      height={340}
      emptyText="暂无数据"
    />
  )
}

export default memo(UtmTrendChart)
