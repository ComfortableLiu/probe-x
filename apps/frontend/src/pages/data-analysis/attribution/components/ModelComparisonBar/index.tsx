import React, { memo, useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { Empty } from 'antd'
import { useLoading, useModel } from '@/hooks'
import { IDataAnalysisAttributionState } from '@pages/data-analysis/attribution/type'
import { AttributionModelEnum } from '@probe-x/shared-types/src'
import * as styles from './styles.module.scss'

/** 归因模型中文名称映射 */
const MODEL_NAME_MAP: Record<AttributionModelEnum, string> = {
  [AttributionModelEnum.FIRST_TOUCH]: '首次触点',
  [AttributionModelEnum.LAST_TOUCH]: '末次触点',
  [AttributionModelEnum.LINEAR]: '线性',
  [AttributionModelEnum.POSITION]: '位置',
  [AttributionModelEnum.TIME_DECAY]: '时间衰减',
}

/**
 * 归因模型对比柱状图
 * 对比不同归因模型下的触点贡献差异
 * X 轴为触点事件名，每个模型一组柱子
 */
function ModelComparisonBar() {

  const chartRef = useRef<echarts.ECharts | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const {
    modelComparisonData,
  } = useModel<IDataAnalysisAttributionState>('dataAnalysisAttributionModel')

  const loading = useLoading()
  const isLoading = loading.dataAnalysisAttributionModel.queryAllModels

  // 将多模型数据转换为 ECharts option
  const chartOption = useMemo<echarts.EChartsOption | null>(() => {
    if (!modelComparisonData?.length) return null

    // 收集所有触点事件名（取并集）
    const allEventNames = new Set<string>()
    for (const item of modelComparisonData) {
      for (const row of item.data.tableData) {
        allEventNames.add(row.touchPointData.attributionEventName)
      }
    }
    const eventNames = Array.from(allEventNames).sort()

    // 为每个模型构建 series
    const series: echarts.SeriesOption[] = modelComparisonData.map((item) => {
      // 按事件名聚合贡献度
      const contributionMap = new Map<string, number>()
      for (const row of item.data.tableData) {
        const eventName = row.touchPointData.attributionEventName
        const existing = contributionMap.get(eventName) || 0
        contributionMap.set(eventName, existing + row.conversionData.contribution.rate)
      }

      return {
        name: MODEL_NAME_MAP[item.model] || item.model,
        type: 'bar' as const,
        data: eventNames.map(name => Number((contributionMap.get(name) || 0).toFixed(2))),
        barGap: '10%',
        emphasis: {
          focus: 'series' as const,
        },
      }
    })

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''
          const eventName = params[0].axisValue
          let html = `<div style="padding: 4px 8px;"><div style="font-weight: 600; margin-bottom: 4px;">${eventName}</div>`
          for (const p of params) {
            html += `<div>${p.marker} ${p.seriesName}：<b>${p.value.toFixed(2)}%</b></div>`
          }
          html += '</div>'
          return html
        },
      },
      legend: {
        data: modelComparisonData.map(item => MODEL_NAME_MAP[item.model] || item.model),
        top: 4,
        type: 'scroll',
      },
      grid: {
        left: 60,
        right: 30,
        bottom: 40,
        top: 40,
      },
      xAxis: {
        type: 'category',
        data: eventNames,
        axisLabel: {
          rotate: eventNames.length > 5 ? 30 : 0,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: '贡献度 (%)',
        axisLabel: {
          formatter: '{value}%',
        },
      },
      series,
    }
  }, [modelComparisonData])

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
    if (isLoading) {
      chartRef.current.showLoading()
    } else {
      chartRef.current.hideLoading()
    }
    if (chartOption) {
      chartRef.current.setOption(chartOption, true)
    } else {
      chartRef.current.clear()
    }
  }, [chartOption, isLoading])

  if (!modelComparisonData?.length && !isLoading) {
    return (
      <div className={styles.container}>
        <h3>归因模型对比</h3>
        <Empty description="请点击"模型对比"按钮加载对比数据" style={{ padding: '40px 0' }} />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h3>归因模型对比</h3>
      <div ref={containerRef} className={styles.chartContainer} />
    </div>
  )
}

export default memo(ModelComparisonBar)