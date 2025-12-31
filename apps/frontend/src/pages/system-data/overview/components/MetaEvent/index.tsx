import React, { memo } from "react"
import { Card, Col, Row, Statistic } from "antd"
import { IEventCollectionMetrics, ISystemDataMetaOverview } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

interface MetaEventProps {
  metaOverview: ISystemDataMetaOverview;
  eventCollectionMetrics: IEventCollectionMetrics;
}

function MetaEvent({ metaOverview, eventCollectionMetrics }: MetaEventProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="元事件数量"
              value={metaOverview.originalDataTotal}
              precision={0}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="清洗后数据量"
              value={metaOverview.finalCleanedData}
              precision={0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="数据清洗率"
              value={metaOverview.finalCleaningSuccessRate || '-'}
              suffix="%"
              precision={2}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }} className={styles.metricGroup}>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.metricCard}`}>
            <Statistic
              title="今日新增"
              value={eventCollectionMetrics.todayCollection}
              precision={0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.metricCard}`}>
            <Statistic
              title="本周新增"
              value={eventCollectionMetrics.weekCollection}
              precision={0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.metricCard}`}>
            <Statistic
              title="本月新增"
              value={eventCollectionMetrics.monthCollection}
              precision={0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.metricCard}`}>
            <Statistic
              title="累计总量"
              value={eventCollectionMetrics.totalAmount}
              precision={0}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default memo(MetaEvent)
