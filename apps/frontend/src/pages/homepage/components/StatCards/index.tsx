import React, { memo } from "react"
import { theme } from "antd"
import {
  RiseOutlined,
  FallOutlined,
  UserOutlined,
  UserAddOutlined,
  FunnelPlotOutlined,
  RetweetOutlined,
  BarChartOutlined,
  DatabaseOutlined,
} from "@ant-design/icons"
import { IHomepageOverview } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface StatCardsProps {
  overview: IHomepageOverview
}

interface IStatItem {
  title: string
  value: number
  precision?: number
  suffix?: string
  icon?: React.ReactNode
  extra?: React.ReactNode
}

function StatCards({ overview }: StatCardsProps) {
  const { token } = theme.useToken()
  // 图标颜色在主题色板中轮换，避免硬编码彩虹色
  const iconColors = [token.colorPrimary, token.colorSuccess, token.colorWarning, token.colorError]

  // 计算环比百分比
  const eventChangePercent = overview.eventTrendChange
  const userChangePercent = overview.yesterdayActiveUserCount > 0
    ? Math.round(((overview.activeUserCount - overview.yesterdayActiveUserCount) / overview.yesterdayActiveUserCount) * 10000) / 100
    : 0

  const renderTrend = (value: number) => {
    if (value > 0) {
      return <span className={styles.trendUp}><RiseOutlined /> +{value}%</span>
    } else if (value < 0) {
      return <span className={styles.trendDown}><FallOutlined /> {value}%</span>
    }
    return <span className={styles.trendNeutral}>持平</span>
  }

  const cards: IStatItem[] = [
    {
      title: "今日事件总数",
      value: overview.todayEventCount,
      icon: <BarChartOutlined style={{ color: iconColors[0] }} />,
      extra: renderTrend(eventChangePercent),
    },
    {
      title: "今日活跃用户",
      value: overview.activeUserCount,
      icon: <UserOutlined style={{ color: iconColors[1] }} />,
      extra: renderTrend(userChangePercent),
    },
    {
      title: "今日新增用户",
      value: overview.newUserCount,
      icon: <UserAddOutlined style={{ color: iconColors[2] }} />,
      extra: <span className={styles.trendNeutral}>首次访问</span>,
    },
    {
      title: "漏斗转化率",
      value: overview.funnelConversionRate,
      precision: 2,
      suffix: "%",
      icon: <FunnelPlotOutlined style={{ color: iconColors[3] }} />,
      extra: <span className={styles.trendNeutral}>近7日均值</span>,
    },
    {
      title: "7日事件趋势",
      value: overview.weekEventCount,
      icon: <RiseOutlined style={{ color: iconColors[0] }} />,
      extra: renderTrend(eventChangePercent),
    },
    {
      title: "用户留存率",
      value: overview.userRetentionRate,
      precision: 2,
      suffix: "%",
      icon: <RetweetOutlined style={{ color: iconColors[1] }} />,
      extra: <span className={styles.trendNeutral}>7日留存</span>,
    },
    {
      title: "昨日事件对比",
      value: overview.yesterdayEventCount,
      icon: <DatabaseOutlined style={{ color: iconColors[2] }} />,
      extra: renderTrend(eventChangePercent),
    },
    {
      title: "总事件数",
      value: overview.totalEventCount,
      icon: <BarChartOutlined style={{ color: iconColors[3] }} />,
      extra: <span className={styles.trendNeutral}>历史累计</span>,
    },
  ]

  return (
    <div className={styles.statCards}>
      {cards.map((card, index) => (
        <MetricCard
          key={index}
          size="small"
          title={card.title}
          value={card.value}
          precision={card.precision}
          suffix={card.suffix}
          icon={card.icon}
          valueStyle={{ fontSize: 28, fontWeight: 700 }}
          extra={card.extra}
        />
      ))}
    </div>
  )
}

export default memo(StatCards)
