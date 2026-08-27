import React, { CSSProperties, memo, ReactNode } from "react"
import { Card, Statistic } from "antd"
import * as styles from "./styles.module.scss"

export type MetricCardStatus = "good" | "warning" | "critical"

interface IMetricCardProps {
  /** 指标标题 */
  title: ReactNode
  /** 指标数值 */
  value: number | string
  /** 数值小数位 */
  precision?: number
  /** 数值后缀（如单位） */
  suffix?: ReactNode
  /** 数值前缀 */
  prefix?: ReactNode
  /** 数值自定义样式 */
  valueStyle?: CSSProperties
  /** 状态，渲染为左侧彩色边框 */
  status?: MetricCardStatus
  /** 顶部图标 */
  icon?: ReactNode
  /** 底部额外内容（如趋势） */
  extra?: ReactNode
  /** 加载态 */
  loading?: boolean
  /** 卡片尺寸 */
  size?: "default" | "small"
  /** 自定义类名 */
  className?: string
}

/**
 * 统一的指标卡片组件
 * 包含标题、数值、可选的状态边框、图标和底部内容
 */
function MetricCard(props: IMetricCardProps) {
  const {
    title,
    value,
    precision,
    suffix,
    prefix,
    valueStyle,
    status,
    icon,
    extra,
    loading = false,
    size,
    className = "",
  } = props

  const statusClassName = status ? {
    good: styles.goodStatus,
    warning: styles.warningStatus,
    critical: styles.criticalStatus,
  }[status] : ""

  const cardClassName = [styles.metricCard, statusClassName, className]
    .filter(Boolean)
    .join(" ")

  return (
    <Card className={cardClassName} loading={loading} size={size}>
      {icon && (
        <div className={styles.icon}>{icon}</div>
      )}
      <Statistic
        title={title}
        value={value}
        precision={precision}
        suffix={suffix}
        prefix={prefix}
        valueStyle={valueStyle}
      />
      {extra && (
        <div className={styles.extra}>{extra}</div>
      )}
    </Card>
  )
}

export default memo(MetricCard)
