import React, { memo } from 'react'
import { Card, Col, Row, Statistic } from 'antd'
import {
  RiseOutlined,
  FallOutlined,
  UserOutlined,
  TeamAddOutlined,
  FunnelPlotOutlined,
  RetweetOutlined,
  BarChartOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import { IHomepageOverview } from '@probe-x/shared-types/src'
import * as styles from './styles.module.scss'

interface StatCardsProps {
  overview: IHomepageOverview
}

interface IStatItem {
  title: string
  value: number
  precision?: number
  suffix?: string
  prefix?: React.ReactNode
  extra?: React.ReactNode
  icon?: React.ReactNode
}

function StatCards({ overview }: StatCardsProps) {
  // 计算环比百分比
  const eventChangePercent = overview.eventTrendChange
  const userChangePercent = overview.yesterdayActiveUserCount > 0
    ? Math.round(((overview.activeUserCount - overview.yesterdayActiveUserCount) / overview.yesterdayActiveUserCount) * 10000) / 100
    : 0

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

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
      title: '今日事件总数',
      value: overview.todayEventCount,
      icon: <BarChartOutlined style={{ color: '#1890ff' }} />,
      extra: renderTrend(eventChangePercent),
    },
    {
      title: '今日活跃用户',
      value: overview.activeUserCount,
      icon: <UserOutlined style={{ color: '#52c41a' }} />,
      extra: renderTrend(userChangePercent),
    },
    {
      title: '今日新增用户',
      value: overview.newUserCount,
      icon: <TeamAddOutlined style={{ color: '#722ed1' }} />,
      extra: <span className={styles.trendNeutral}>首次访问</span>,
    },
    {
      title: '漏斗转化率',
      value: overview.funnelConversionRate,
      precision: 2,
      suffix: '%',
      icon: <FunnelPlotOutlined style={{ color: '#fa8c16' }} />,
      extra: <span className={styles.trendNeutral}>近7日均值</span>,
    },
    {
      title: '7日事件趋势',
      value: overview.weekEventCount,
      icon: <RiseOutlined style={{ color: '#13c2c2' }} />,
      extra: renderTrend(eventChangePercent),
    },
    {
      title: '用户留存率',
      value: overview.userRetentionRate,
      precision: 2,
      suffix: '%',
      icon: <RetweetOutlined style={{ color: '#eb2f96' }} />,
      extra: <span className={styles.trendNeutral}>7日留存</span>,
    },
    {
      title: '昨日事件对比',
      value: overview.yesterdayEventCount,
      icon: <DatabaseOutlined style={{ color: '#595959' }} />,
      extra: renderTrend(eventChangePercent),
    },
    {
      title: '总事件数',
      value: overview.totalEventCount,
      icon: <BarChartOutlined style={{ color: '#2f54eb' }} />,
      extra: <span className={styles.trendNeutral}>历史累计</span>,
    },
  ]

  return (
    <div className={styles.statCards}>
      {cards.map((card, index) => (
        <Card key={index} className={styles.statCard} size="small">
          <div className={styles.statIcon}>{card.icon}</div>
          <Statistic
            title={card.title}
            value={card.value}
            precision={card.precision}
            suffix={card.suffix}
            valueStyle={{ fontSize: 28, fontWeight: 700 }}
          />
          {card.extra && (
            <div className={styles.statExtra}>{card.extra}</div>
          )}
        </Card>
      ))}
    </div>
  )
}

export default memo(StatCards)
