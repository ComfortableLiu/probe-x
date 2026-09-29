import React, { memo } from "react"
import { Col, Row } from "antd"
import { ISystemPerformanceMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface ErrorRateProps {
  systemPerformanceMetrics: ISystemPerformanceMetrics;
}

function ErrorRate({ systemPerformanceMetrics }: ErrorRateProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <MetricCard
            title="HTTP 4xx 错误率"
            value={systemPerformanceMetrics.requestErrorRate ?? '—'}
            suffix="%"
            precision={2}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="HTTP 5xx 错误率"
            value={systemPerformanceMetrics.systemErrorRate ?? '—'}
            suffix="%"
            precision={2}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="业务错误率"
            value={systemPerformanceMetrics.businessErrorRate ?? '—'}
            suffix="%"
            precision={2}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(ErrorRate)
