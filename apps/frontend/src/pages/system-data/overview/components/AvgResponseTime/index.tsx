import React, { memo } from "react"
import { Col, Row } from "antd"
import { ISystemPerformanceMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface AvgResponseTimeProps {
  systemPerformanceMetrics: ISystemPerformanceMetrics;
}

function AvgResponseTime({ systemPerformanceMetrics }: AvgResponseTimeProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <MetricCard
            title="平均响应时间"
            value={systemPerformanceMetrics.avgResponseTime}
            suffix="ms"
            precision={1}
            status="good"
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="95th响应时间"
            value={systemPerformanceMetrics.p95ResponseTime}
            suffix="ms"
            precision={1}
            status="warning"
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="99th响应时间"
            value={systemPerformanceMetrics.p99ResponseTime}
            suffix="ms"
            precision={1}
            status="critical"
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(AvgResponseTime)
