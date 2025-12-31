import React, { memo } from "react"
import { Card, Col, Row, Statistic } from "antd"
import { ISystemPerformanceMetrics } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

interface AvgResponseTimeProps {
  systemPerformanceMetrics: ISystemPerformanceMetrics;
}

function AvgResponseTime({ systemPerformanceMetrics }: AvgResponseTimeProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="平均响应时间"
              value={systemPerformanceMetrics.avgResponseTime}
              suffix="ms"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.warningStatus}`}>
            <Statistic
              title="95th响应时间"
              value={systemPerformanceMetrics.p95ResponseTime}
              suffix="ms"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.criticalStatus}`}>
            <Statistic
              title="99th响应时间"
              value={systemPerformanceMetrics.p99ResponseTime}
              suffix="ms"
              precision={1}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default memo(AvgResponseTime)