import React, { memo } from "react"
import { Card, Col, Row, Statistic } from "antd"
import { ISystemPerformanceMetrics } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

interface SystemPerformanceProps {
  systemPerformanceMetrics: ISystemPerformanceMetrics;
}

function SystemPerformance({ systemPerformanceMetrics }: SystemPerformanceProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="当前QPS"
              value={systemPerformanceMetrics.currentQps}
              precision={0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.warningStatus}`}>
            <Statistic
              title="峰值QPS"
              value={systemPerformanceMetrics.peakQps}
              precision={0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="平均QPS"
              value={systemPerformanceMetrics.avgQps}
              precision={0}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default memo(SystemPerformance)