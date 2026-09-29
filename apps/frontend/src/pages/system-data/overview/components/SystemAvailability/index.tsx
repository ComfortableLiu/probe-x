import React, { memo } from "react"
import { Col, Row } from "antd"
import { ISystemPerformanceMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface SystemAvailabilityProps {
  systemPerformanceMetrics: ISystemPerformanceMetrics;
}

function SystemAvailability({ systemPerformanceMetrics }: SystemAvailabilityProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={12}>
          <MetricCard
            title="上一分钟请求成功率"
            value={systemPerformanceMetrics.systemAvailability ?? '—'}
            suffix="%"
            precision={2}
          />
        </Col>
        <Col span={12}>
          <MetricCard
            title="本月已采样请求成功率"
            value={systemPerformanceMetrics.currentMonthAvailability ?? '—'}
            suffix="%"
            precision={2}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(SystemAvailability)
