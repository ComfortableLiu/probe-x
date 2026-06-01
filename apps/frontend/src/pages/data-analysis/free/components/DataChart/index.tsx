import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import * as echarts from "echarts"
import { useModel, useQuery } from "@/hooks"
import { IDataAnalysisFreeState, IQuery } from "@pages/data-analysis/free/type"
import { Empty, Radio } from "antd"
import dayjs from "dayjs"

function DataChart() {

  const chartRef = useRef<echarts.ECharts | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

  const {
    timeRange,
    eventInfoList = [],
  } = useQuery<IQuery>()

  const {
    data,
  } = useModel<IDataAnalysisFreeState>('dataAnalysisFreeModel')

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
        type: chartType,
        data: seriesData,
        smooth: chartType === 'line',
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
  }, [data, eventInfoList, dateList, chartType])

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

  // 数据变化时更新图表（含懒初始化）
  useEffect(() => {
    if (!chartOption) return
    if (!chartRef.current && containerRef.current) {
      chartRef.current = echarts.init(containerRef.current)
    }
    if (chartRef.current) {
      chartRef.current.setOption(chartOption, true)
      chartRef.current.resize()
    }
  }, [chartOption])

  const hasData = !!data?.length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>图形展示</h3>
        {hasData && (
          <Radio.Group
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="line">折线图</Radio.Button>
            <Radio.Button value="bar">柱状图</Radio.Button>
          </Radio.Group>
        )}
      </div>
      {!hasData && <Empty description="暂无数据，请先查询" style={{ padding: '60px 0' }} />}
      <div ref={containerRef} style={{ width: '100%', height: 500, display: hasData ? 'block' : 'none' }} />
    </div>
  )
}

export default memo(DataChart)
