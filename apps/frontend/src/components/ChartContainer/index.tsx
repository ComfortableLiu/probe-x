import React, { CSSProperties, memo, useEffect, useMemo, useRef } from "react"
import * as echarts from "echarts"
import type { ECharts, EChartsOption } from "echarts"
import { Empty, theme } from "antd"
import { getBaseChartOption, mergeChartOption } from "@utils/chartTheme"
import * as styles from "./styles.module.scss"

interface IChartContainerProps {
  /** 图表配置，会与主题基础配置深合并（传入配置优先） */
  option: EChartsOption | null
  /** 图表高度，默认 320 */
  height?: number
  /** 加载状态，展示 loading 动画并保留当前图表 */
  loading?: boolean
  /** 空数据状态，展示 Empty 占位（默认按 option 为空判断） */
  empty?: boolean
  /** 空状态描述文案 */
  emptyText?: string
  /** 图表事件绑定，如 { click: (params) => {} } */
  onEvents?: Record<string, (params: unknown) => void>
  /** 图表实例初始化完成回调，可用于 getDataURL 等场景 */
  onInit?: (chart: ECharts) => void
  /** 自定义类名 */
  className?: string
  /** 自定义样式 */
  style?: CSSProperties
}

/**
 * 统一的 ECharts 容器组件
 * 负责实例初始化、主题合并、ResizeObserver 自适应、事件绑定与销毁
 */
function ChartContainer(props: IChartContainerProps) {
  const {
    option,
    height = 320,
    loading = false,
    empty,
    emptyText = "暂无数据",
    onEvents,
    onInit,
    className = "",
    style,
  } = props

  const { token } = theme.useToken()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ECharts | null>(null)

  const isEmpty = empty ?? !option

  const mergedOption = useMemo(() => {
    if (!option) return null
    const baseOption = getBaseChartOption(token)
    // 饼图、漏斗图、桑基图等无坐标轴图表不注入坐标轴样式，避免渲染出空轴
    if (!option.xAxis) delete baseOption.xAxis
    if (!option.yAxis) delete baseOption.yAxis
    return mergeChartOption(baseOption, option)
  }, [option, token])

  // 初始化 ECharts 实例 + ResizeObserver 自适应
  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    onInit?.(chart)

    // 延迟到下一帧再 resize，避免 ResizeObserver loop completed with undelivered notifications 报错
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => chart.resize())
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.dispose()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 数据变化时更新图表
  useEffect(() => {
    if (!chartRef.current || !mergedOption) return
    chartRef.current.setOption(mergedOption, true)
  }, [mergedOption])

  // 事件绑定
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    const entries = Object.entries(onEvents)
    entries.forEach(([eventName, handler]) => {
      chart.on(eventName, handler)
    })
    return () => {
      entries.forEach(([eventName, handler]) => {
        chart.off(eventName, handler)
      })
    }
  }, [onEvents])

  // 加载状态
  useEffect(() => {
    if (!chartRef.current) return
    if (loading) {
      chartRef.current.showLoading()
    } else {
      chartRef.current.hideLoading()
    }
  }, [loading])

  return (
    <div className={`${styles.chartContainer} ${className}`} style={style}>
      {isEmpty && (
        <Empty
          description={emptyText}
          className={styles.empty}
          style={{ height }}
        />
      )}
      <div
        ref={containerRef}
        className={styles.chart}
        style={{ height, display: isEmpty ? "none" : "block" }}
      />
    </div>
  )
}

export default memo(ChartContainer)
