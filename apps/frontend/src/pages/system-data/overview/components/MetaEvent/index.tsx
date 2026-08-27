import React, { memo } from "react"
import { Col, Row, theme } from "antd"
import { IEventCollectionMetrics, ISystemDataMetaOverview } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface MetaEventProps {
  metaOverview: ISystemDataMetaOverview;
  eventCollectionMetrics: IEventCollectionMetrics;
}

function MetaEvent({ metaOverview, eventCollectionMetrics }: MetaEventProps) {
  const { token } = theme.useToken()

  // 防御性编程：确保 metaOverview 不为 null
  const safeMetaOverview = metaOverview || {
    originalDataTotal: '0',
    finalCleanedData: '0',
    firstCleaningSuccessRate: 0,
    finalCleaningSuccessRate: 0,
  }

  // 防御性编程：确保 eventCollectionMetrics 不为 null
  const safeEventCollectionMetrics = eventCollectionMetrics || {
    todayCollection: 0,
    yesterdayCollection: 0,
    weekCollection: 0,
    monthCollection: 0,
    totalAmount: 0,
  }

  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <MetricCard
            title="元事件数量"
            value={safeMetaOverview.originalDataTotal}
            precision={0}
            valueStyle={{ color: token.colorSuccess }}
            status="good"
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="清洗后数据量"
            value={safeMetaOverview.finalCleanedData}
            precision={0}
            valueStyle={{ color: token.colorPrimary }}
            status="good"
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="数据清洗率"
            value={safeMetaOverview.finalCleaningSuccessRate || '-'}
            suffix="%"
            precision={2}
            valueStyle={{ color: token.colorWarning }}
            status="good"
          />
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }} className={styles.metricGroup}>
        <Col span={6}>
          <MetricCard
            title="今日新增"
            value={safeEventCollectionMetrics.todayCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本周新增"
            value={safeEventCollectionMetrics.weekCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本月新增"
            value={safeEventCollectionMetrics.monthCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="累计总量"
            value={safeEventCollectionMetrics.totalAmount}
            precision={0}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(MetaEvent)
