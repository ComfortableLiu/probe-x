import React, { memo, useMemo } from "react"
import { useModel } from "@/hooks"
import { IDataAnalysisEventState } from "@pages/data-analysis/event/type"
import dayjs from "dayjs"
import type { EChartsOption, SeriesOption } from "echarts"
import ChartContainer from "@components/ChartContainer"

function DataChat() {

  // 使用查询参数快照渲染，避免修改筛选配置后图表实时跟随变化（需点击「查询」才更新）
  const {
    data,
    querySnapshot,
  } = useModel<IDataAnalysisEventState>('dataAnalysisEventModel')

  const timeRange = querySnapshot?.timeRange
  const eventInfoList = useMemo(() => querySnapshot?.eventInfoList || [], [querySnapshot])

  // 日期列表
  const dateList = useMemo(() => {
    if (!timeRange?.[0] || !timeRange?.[1]) return []
    const dates: string[] = []
    for (let i = dayjs(timeRange[0]); i.isBefore(dayjs(timeRange[1])) || i.isSame(dayjs(timeRange[1])); i = i.add(1, 'day')) {
      dates.push(i.format('YYYY-MM-DD'))
    }
    return dates
  }, [timeRange])

  // 将 API 数据转换为 ECharts option
  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!data?.length || !eventInfoList?.length || !dateList.length) return null

    // 生成事件别名映射（与 SQL 生成规则一致）
    const eventAliases = eventInfoList.map((info, index) => ({
      alias: `event_${index}_${info.eventName?.replace(/\W+/g, '_') || 'unknown'}`,
      name: info.eventName || 'unknown_event',
    }))

    // 按事件分组，聚合所有维度行的指标值
    const seriesList: SeriesOption[] = eventAliases.map(({ alias, name }) => {
      const seriesData = dateList.map((date) => {
        const metricKey = `${alias}_${date.replace(/-/g, '_')}`
        // 对所有维度行的同一事件-日期指标求和
        return data.reduce((sum, row) => sum + (Number(row[metricKey]) || 0), 0)
      })
      return {
        name,
        type: 'line' as const,
        data: seriesData,
        smooth: true,
      }
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
        data: eventAliases.map(e => e.name),
        top: 0,
      },
      toolbox: {
        show: true,
        feature: {
          magicType: {
            show: true,
            type: ['line', 'bar'],
          },
          saveAsImage: {
            show: true,
          },
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
      },
    }
  }, [data, eventInfoList, dateList])

  const hasData = !!data?.length

  return (
    <div>
      <h3>图形展示</h3>
      <ChartContainer
        option={chartOption}
        height={500}
        empty={!hasData}
        emptyText="暂无数据，请先查询"
      />
    </div>
  )
}

export default memo(DataChat)
