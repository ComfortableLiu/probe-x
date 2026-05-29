import React, { memo, useEffect, useRef } from 'react'
import { Card } from 'antd'
import * as echarts from 'echarts'
import { IHomepageTrend } from '@probe-x/shared-types/src'
import * as styles from './styles.module.scss'

interface TrendChartProps {
  trend: IHomepageTrend
}

function TrendChart({ trend }: TrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    chartInstanceRef.current = echarts.init(chartRef.current)

    const handleResize = () => {
      chartInstanceRef.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstanceRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!chartInstanceRef.current) return

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#999',
            width: 1,
            type: 'solid',
          },
        },
      },
      legend: {
        data: ['事件量', '活跃用户'],
        top: 4,
        right: 16,
      },
      grid: {
        left: 60,
        right: 60,
        bottom: 40,
        top: 40,
      },
      xAxis: {
        type: 'category',
        data: trend.dates,
        axisLabel: {
          formatter: (value: string) => {
            // 只显示月-日
            const parts = value.split('-')
            return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : value
          },
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '事件量',
          position: 'left',
          axisLabel: {
            formatter: (value: number) => {
              if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
              return value.toString()
            },
          },
          splitLine: {
            lineStyle: {
              type: 'dashed',
            },
          },
        },
        {
          type: 'value',
          name: '活跃用户',
          position: 'right',
          axisLabel: {
            formatter: (value: number) => {
              if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
              return value.toString()
            },
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '事件量',
          type: 'line',
          data: trend.eventCounts,
          smooth: true,
          yAxisIndex: 0,
          itemStyle: {
            color: '#1890ff',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.02)' },
            ]),
          },
        },
        {
          name: '活跃用户',
          type: 'line',
          data: trend.activeUserCounts,
          smooth: true,
          yAxisIndex: 1,
          itemStyle: {
            color: '#52c41a',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
              { offset: 1, color: 'rgba(82, 196, 26, 0.02)' },
            ]),
          },
        },
      ],
    }

    chartInstanceRef.current.setOption(option, true)
  }, [trend])

  return (
    <Card
      title="事件趋势 & 用户活跃趋势"
      className={styles.trendChart}
      size="small"
    >
      <div ref={chartRef} className={styles.chartContainer} />
    </Card>
  )
}

export default memo(TrendChart)
