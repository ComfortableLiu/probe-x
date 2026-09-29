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
            title="上一分钟平均 QPS"
            value={systemPerformanceMetrics.currentQps ?? '—'}
            precision={2}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="今日分钟峰值 QPS"
            value={systemPerformanceMetrics.peakQps ?? '—'}
            precision={2}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="今日采样平均 QPS"
            value={systemPerformanceMetrics.avgQps ?? '—'}
            precision={2}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(SystemPerformance)
