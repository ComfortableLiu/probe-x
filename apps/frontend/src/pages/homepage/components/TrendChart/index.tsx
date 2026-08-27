import React, { memo, useMemo } from 'react'
import { Card, theme } from 'antd'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { IHomepageTrend } from '@probe-x/shared-types/src'
import ChartContainer from '@components/ChartContainer'
import { hexToRgba } from '@utils/chartTheme'
import * as styles from './styles.module.scss'

interface TrendChartProps {
  trend: IHomepageTrend
}

function TrendChart({ trend }: TrendChartProps) {
  const { token } = theme.useToken()

  const option = useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
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
          color: token.colorPrimary,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexToRgba(token.colorPrimary, 0.3) },
            { offset: 1, color: hexToRgba(token.colorPrimary, 0.02) },
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
          color: token.colorSuccess,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexToRgba(token.colorSuccess, 0.3) },
            { offset: 1, color: hexToRgba(token.colorSuccess, 0.02) },
          ]),
        },
      },
    ],
  }), [trend, token])

  return (
    <Card
      title="事件趋势 & 用户活跃趋势"
      className={styles.trendChart}
      size="small"
    >
      <ChartContainer
        className={styles.chartContainer}
        option={option}
        height={350}
        empty={!trend.dates?.length}
      />
    </Card>
  )
}

export default memo(TrendChart)
