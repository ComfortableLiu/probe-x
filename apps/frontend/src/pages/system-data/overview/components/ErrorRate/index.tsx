import React, { memo } from "react"
import { Card, Col, Row, Statistic } from "antd"
import { ISystemPerformanceMetrics } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

interface ErrorRateProps {
  systemPerformanceMetrics: ISystemPerformanceMetrics;
}

function ErrorRate({ systemPerformanceMetrics }: ErrorRateProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.warningStatus}`}>
            <Statistic
              title="请求错误率"
              value={systemPerformanceMetrics.requestErrorRate}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.warningStatus}`}>
            <Statistic
              title="系统错误率"
              value={systemPerformanceMetrics.systemErrorRate}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.warningStatus}`}>
            <Statistic
              title="异常捕获率"
              value={systemPerformanceMetrics.exceptionCaptureRate}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default memo(ErrorRate)