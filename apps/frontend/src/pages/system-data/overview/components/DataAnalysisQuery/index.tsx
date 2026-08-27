import React, { memo } from "react"
import { Col, Row } from "antd"
import { IEventCollectionMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface DataAnalysisQueryProps {
  eventCollectionMetrics: IEventCollectionMetrics;
}

function DataAnalysisQuery({ eventCollectionMetrics }: DataAnalysisQueryProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={6}>
          <MetricCard
            title="今日查询"
            value={eventCollectionMetrics.todayCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="昨日查询"
            value={eventCollectionMetrics.yesterdayCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本周查询"
            value={eventCollectionMetrics.weekCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本月查询"
            value={eventCollectionMetrics.monthCollection}
            precision={0}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(DataAnalysisQuery)
