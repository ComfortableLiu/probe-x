import React, { memo } from "react"
import { Card, Col, Divider, Row, Statistic } from "antd"
import { IComputingNodeStatus } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

interface ComputingNodeStatusProps {
  computingNodeStatus: IComputingNodeStatus;
}

function ComputingNodeStatus({ computingNodeStatus }: ComputingNodeStatusProps) {
  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="总节点数"
              value={computingNodeStatus.totalNodes}
              precision={0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="在线节点"
              value={computingNodeStatus.onlineNodes}
              precision={0}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.criticalStatus}`}>
            <Statistic
              title="离线节点"
              value={computingNodeStatus.offlineNodes}
              precision={0}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="在线率"
              value={computingNodeStatus.onlineRate}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
      </Row>
      <Divider />
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.warningStatus}`}>
            <Statistic
              title="CPU使用率"
              value={computingNodeStatus.cpuUsage}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.warningStatus}`}>
            <Statistic
              title="内存使用率"
              value={computingNodeStatus.memoryUsage}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="平均负载"
              value={computingNodeStatus.avgLoad}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={`${styles.metricCard} ${styles.goodStatus}`}>
            <Statistic
              title="网络流量"
              value={computingNodeStatus.networkTraffic}
              suffix="Gbps"
              precision={2}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default memo(ComputingNodeStatus)