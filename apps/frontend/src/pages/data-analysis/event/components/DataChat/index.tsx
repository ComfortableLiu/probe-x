import React, { memo, useEffect, useMemo, useRef } from "react"
import * as echarts from "echarts"
import { useModel, useQuery } from "@/hooks"
import { IDataAnalysisEventState, IQuery } from "@pages/data-analysis/event/type"
import { Empty } from "antd"
import dayjs from "dayjs"

export default memo(DataChat)

function DataChat() {

  const chartRef = useRef<echarts.ECharts | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const {
    timeRange,
    eventInfoList = [],
  } = useQuery<IQuery>()

  const {
    data,
  } = useModel<IDataAnalysisEventState>('dataAnalysisEventModel')

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
  const chartOption = useMemo<echarts.EChartsOption | null>(() => {
    if (!data?.length || !eventInfoList?.length || !dateList.length) return null

    // 生成事件别名映射（与 SQL 生成规则一致）
    const eventAliases = eventInfoList.map((info, index) => ({
      alias: `event_${index}_${info.eventName?.replace(/\W+/g, '_') || 'unknown'}`,
      name: info.eventName || 'unknown_event',
    }))

    // 按事件分组，聚合所有维度行的指标值
    const seriesList: echarts.SeriesOption[] = eventAliases.map(({ alias, name }) => {
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
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 40,
        containLabel: true,
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
          lineStyle: {
            color: '#999',
            width: 1,
            type: 'solid',
          },
          label: {
            show: true,
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: 11,
          },
        },
      },
    }
  }, [data, eventInfoList, dateList])

  // 初始化 ECharts 实例
  useEffect(() => {
    if (containerRef.current) {
      chartRef.current = echarts.init(containerRef.current)
    }
    const handleResize = () => {
      chartRef.current?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  // 数据变化时更新图表
  useEffect(() => {
    if (!chartRef.current) return
    if (chartOption) {
      chartRef.current.setOption(chartOption, true)
    } else {
      chartRef.current.clear()
    }
  }, [chartOption])

  if (!data?.length) {
    return (
      <div>
        <h3>图形展示</h3>
        <Empty description="暂无数据，请先查询" style={{ padding: '60px 0' }} />
      </div>
    )
  }

  return (
    <div>
      <h3>图形展示</h3>
      <div ref={containerRef} style={{ width: '100%', height: 500 }} />
    </div>
  )
}
