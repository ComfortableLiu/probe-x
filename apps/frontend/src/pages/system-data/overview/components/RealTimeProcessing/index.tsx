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
            title="上一分钟写入量"
            value={realTimeProcessingMetrics.currentProcessing ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="今日分钟写入峰值"
            value={realTimeProcessingMetrics.peakProcessing ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="清洗后事件存量"
            value={realTimeProcessingMetrics.cumulativeProcessing ?? '—'}
            precision={0}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(RealTimeProcessing)
