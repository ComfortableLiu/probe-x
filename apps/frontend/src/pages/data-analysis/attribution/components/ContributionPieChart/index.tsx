import React, { memo, useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { Empty } from 'antd'
import { useModel } from '@/hooks'
import { IDataAnalysisAttributionState } from '@pages/data-analysis/attribution/type'
import * as styles from './styles.module.scss'

/**
 * 贡献度饼图
 * 展示各触点/渠道的贡献度占比分布
 * 按归因事件名聚合（相同事件名的不同维度行合并）
 */
function ContributionPieChart() {

  const chartRef = useRef<echarts.ECharts | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const {
    data,
  } = useModel<IDataAnalysisAttributionState>('dataAnalysisAttributionModel')

  // 按归因事件名聚合贡献度
  const chartOption = useMemo<echarts.EChartsOption | null>(() => {
    if (!data?.tableData?.length) return null

    // 按 attributionEventName 聚合
    const aggregationMap = new Map<string, { contribution: number; conversionMetric: number }>()
    for (const row of data.tableData) {
      const eventName = row.touchPointData.attributionEventName
      const existing = aggregationMap.get(eventName) || { contribution: 0, conversionMetric: 0 }
      existing.contribution += row.conversionData.contribution.rate
      existing.conversionMetric += row.conversionData.conversionMetric
      aggregationMap.set(eventName, existing)
    }

    // 转换为饼图数据
    const pieData = Array.from(aggregationMap.entries())
      .map(([name, value]) => ({
        name,
        value: Number(value.contribution.toFixed(2)),
        conversionMetric: value.conversionMetric,
      }))
      .sort((a, b) => b.value - a.value)

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const { name, value, conversionMetric } = params.data
          return `
            <div style="padding: 4px 8px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${name}</div>
              <div>贡献度：${value.toFixed(2)}%</div>
              <div>转化指标：${conversionMetric}</div>
            </div>
          `
        },
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        type: 'scroll',
      },
      series: [
        {
          name: '贡献度',
          type: 'pie',
          radius: ['35%', '65%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}: {d}%',
            fontSize: 11,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
          data: pieData,
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

  const hasData = !!data?.tableData?.length

  return (
    <div className={styles.container}>
      <h3>贡献度分布</h3>
      {!hasData && <Empty description="暂无数据，请先查询" style={{ padding: '40px 0' }} />}
      <div ref={containerRef} className={styles.chartContainer} style={{ display: hasData ? 'block' : 'none' }} />
    </div>
  )
}

export default memo(ContributionPieChart)