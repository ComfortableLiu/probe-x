import React, { memo } from "react"
import { Col, Row } from "antd"
import { IEventCollectionMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface EventCollectionVolumeProps {
  eventCollectionMetrics: IEventCollectionMetrics;
}

function EventCollectionVolume({ eventCollectionMetrics }: EventCollectionVolumeProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={6}>
          <MetricCard
            title="今日收集"
            value={eventCollectionMetrics.todayCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="昨日收集"
            value={eventCollectionMetrics.yesterdayCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本周收集"
            value={eventCollectionMetrics.weekCollection}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本月收集"
            value={eventCollectionMetrics.monthCollection}
            precision={0}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(EventCollectionVolume)
