import React, { memo } from "react"
import { Col, Row } from "antd"
import { ISystemPerformanceMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface SystemPerformanceProps {
  systemPerformanceMetrics: ISystemPerformanceMetrics;
}

function SystemPerformance({ systemPerformanceMetrics }: SystemPerformanceProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <MetricCard
            title="当前QPS"
            value={systemPerformanceMetrics.currentQps}
            precision={0}
            status="good"
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="峰值QPS"
            value={systemPerformanceMetrics.peakQps}
            precision={0}
            status="warning"
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="平均QPS"
            value={systemPerformanceMetrics.avgQps}
            precision={0}
            status="good"
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(SystemPerformance)
