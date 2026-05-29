import React, { memo, useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { Empty } from 'antd'
import { useModel } from '@/hooks'
import { IDataAnalysisAttributionState } from '@pages/data-analysis/attribution/type'
import * as styles from './styles.module.scss'

/**
 * 归因漏斗图
 * 展示各触点事件到转化的转化漏斗
 * 按归因事件名聚合转化指标，按贡献度降序排列
 */
function AttributionFunnelChart() {

  const chartRef = useRef<echarts.ECharts | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const {
    data,
  } = useModel<IDataAnalysisAttributionState>('dataAnalysisAttributionModel')

  // 按归因事件名聚合，构建漏斗数据
  const chartOption = useMemo<echarts.EChartsOption | null>(() => {
    if (!data?.tableData?.length) return null

    // 按 attributionEventName 聚合
    const aggregationMap = new Map<string, { conversionMetric: number; conversionRate: number; contribution: number; count: number }>()
    for (const row of data.tableData) {
      const eventName = row.touchPointData.attributionEventName
      const existing = aggregationMap.get(eventName) || { conversionMetric: 0, conversionRate: 0, contribution: 0, count: 0 }
      existing.conversionMetric += row.conversionData.conversionMetric
      existing.conversionRate += row.conversionData.conversionRate
      existing.contribution += row.conversionData.contribution.rate
      existing.count += 1
      aggregationMap.set(eventName, existing)
    }

    // 转换为漏斗数据，按贡献度降序
    const funnelData = Array.from(aggregationMap.entries())
      .map(([name, value]) => ({
        name,
        value: Number(value.contribution.toFixed(2)),
        conversionMetric: Math.round(value.conversionMetric),
        avgConversionRate: Number((value.conversionRate / value.count).toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value)

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const { name, data: itemData } = params
          return `
            <div style="padding: 4px 8px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${name}</div>
              <div>贡献度：${itemData.value.toFixed(2)}%</div>
              <div>转化指标：${itemData.conversionMetric}</div>
              <div>平均转化率：${itemData.avgConversionRate}%</div>
            </div>
          `
        },
      },
      series: [
        {
          name: '归因漏斗',
          type: 'funnel',
          left: '10%',
          top: 20,
          bottom: 20,
          width: '80%',
          min: 0,
          max: 100,
          minSize: '10%',
          maxSize: '100%',
          sort: 'descending',
          gap: 3,
          label: {
            show: true,
            position: 'inside',
            formatter: (params: any) => {
              return `${params.name}\n${params.data.value.toFixed(1)}%`
            },
            fontSize: 11,
            lineHeight: 16,
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
          },
          emphasis: {
            label: {
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          data: funnelData,
        },
      ],
    }
  }, [data?.tableData])

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

  if (!data?.tableData?.length) {
    return (
      <div className={styles.container}>
        <h3>归因转化漏斗</h3>
        <Empty description="暂无数据，请先查询" style={{ padding: '40px 0' }} />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h3>归因转化漏斗</h3>
      <div ref={containerRef} className={styles.chartContainer} />
    </div>
  )
}

export default memo(AttributionFunnelChart)