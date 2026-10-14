import React, { memo } from "react"
import { Col, Row } from "antd"
import { IRealTimeProcessingMetrics } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface RealTimeProcessingProps {
  realTimeProcessingMetrics: IRealTimeProcessingMetrics;
}

function RealTimeProcessing({ realTimeProcessingMetrics }: RealTimeProcessingProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={8}>
          <MetricCard
            title="上一分钟写入量"
            value={realTimeProcessingMetrics.currentProcessing ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="今日分钟写入峰值"
            value={realTimeProcessingMetrics.peakProcessing ?? '—'}
            precision={0}
          />
        </Col>
        <Col span={8}>
          <MetricCard
            title="清洗后事件存量"
            value={realTimeProcessingMetrics.cumulativeProcessing ?? '—'}
            precision={0}
          />
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }} className={styles.metricGroup}>
        <Col span={6}>
          <MetricCard
            title="实时清洗速度"
            value={realTimeProcessingMetrics.currentCleaningSpeed ?? '—'}
            precision={1}
            suffix="条/s"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="今日峰值速度"
            value={realTimeProcessingMetrics.peakCleaningSpeed ?? '—'}
            precision={1}
            suffix="条/s"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="实时清洗速度"
            value={realTimeProcessingMetrics.currentSessionSpeed ?? '—'}
            precision={2}
            suffix="session/s"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="今日峰值速度"
            value={realTimeProcessingMetrics.peakSessionSpeed ?? '—'}
            precision={2}
            suffix="session/s"
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(RealTimeProcessing)
