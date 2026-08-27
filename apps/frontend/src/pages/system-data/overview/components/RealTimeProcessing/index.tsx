import React, { memo } from "react"
import { Col, Row } from "antd"
import { IRealTimeProcessingMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface RealTimeProcessingProps {
  realTimeProcessingMetrics: IRealTimeProcessingMetrics;
}

function RealTimeProcessing({ realTimeProcessingMetrics }: RealTimeProcessingProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <MetricCard
            title="当前处理量"
            value={realTimeProcessingMetrics.currentProcessing}
            precision={0}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="峰值处理量"
            value={realTimeProcessingMetrics.peakProcessing}
            precision={0}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="累计处理量"
            value={realTimeProcessingMetrics.cumulativeProcessing}
            precision={0}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(RealTimeProcessing)
