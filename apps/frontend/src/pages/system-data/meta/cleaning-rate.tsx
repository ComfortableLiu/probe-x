import React from "react"
import { Progress, Statistic, Typography } from "antd"

interface CleaningRateProps {
  rate: number | null;
  color?: string;
}

export function CleaningRateStatistic({
  rate,
  color,
  title,
}: CleaningRateProps & { title: React.ReactNode }) {
  const hasSample = typeof rate === 'number' && Number.isFinite(rate)

  return (
    <Statistic
      title={title}
      value={hasSample ? rate : '—'}
      precision={hasSample ? 2 : undefined}
      suffix={hasSample ? '%' : undefined}
      valueStyle={{ color }}
    />
  )
}

export function CleaningRateProgress({ rate, color }: CleaningRateProps) {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    return <Typography.Text type="secondary">—（暂无采样）</Typography.Text>
  }

  return <Progress percent={rate} strokeColor={color} />
}
