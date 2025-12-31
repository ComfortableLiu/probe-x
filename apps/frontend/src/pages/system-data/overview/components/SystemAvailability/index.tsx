import React, { memo } from "react"
import { Card, Col, Row, Statistic } from "antd"
import { ISystemPerformanceMetrics } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

interface SystemAvailabilityProps {
  systemPerformanceMetrics: ISystemPerformanceMetrics;
}

function SystemAvailability({ systemPerformanceMetrics }: SystemAvailabilityProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={12}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="当前可用性"
              value={systemPerformanceMetrics.systemAvailability}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="本月可用性"
              value={systemPerformanceMetrics.currentMonthAvailability}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default memo(SystemAvailability)