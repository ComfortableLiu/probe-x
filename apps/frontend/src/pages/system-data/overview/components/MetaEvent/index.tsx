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

  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <MetricCard
            title="原始事件存量"
            value={metaOverview.originalDataTotal}
            precision={0}
            valueStyle={{ color: token.colorSuccess }}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="清洗后数据量"
            value={metaOverview.finalCleanedData}
            precision={0}
            valueStyle={{ color: token.colorPrimary }}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="今日清洗任务成功率"
            value={metaOverview.finalCleaningSuccessRate ?? '—'}
            suffix="%"
            precision={2}
            valueStyle={{ color: token.colorWarning }}
          />
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }} className={styles.metricGroup}>
        <Col span={6}>
          <MetricCard
            title="今日新增"
            value={eventCollectionMetrics.todayCollection ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本周新增"
            value={eventCollectionMetrics.weekCollection ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本月新增"
            value={eventCollectionMetrics.monthCollection ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="原始事件存量"
            value={eventCollectionMetrics.totalAmount ?? '—'}
            precision={0}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(MetaEvent)
