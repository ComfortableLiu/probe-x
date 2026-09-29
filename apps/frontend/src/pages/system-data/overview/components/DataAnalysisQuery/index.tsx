import React, { memo } from "react"
import { Col, Row } from "antd"
import { IAnalysisQueryMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface DataAnalysisQueryProps {
  analysisQueryMetrics: IAnalysisQueryMetrics;
}

function DataAnalysisQuery({ analysisQueryMetrics }: DataAnalysisQueryProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={6}>
          <MetricCard
            title="今日查询"
            value={analysisQueryMetrics.todayQueries ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="昨日查询"
            value={analysisQueryMetrics.yesterdayQueries ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本周查询"
            value={analysisQueryMetrics.weekQueries ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="本月查询"
            value={analysisQueryMetrics.monthQueries ?? '—'}
            precision={0}
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(DataAnalysisQuery)
