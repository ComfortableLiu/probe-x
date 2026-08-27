import React, { memo } from "react"
import { Col, Divider, Row, theme } from "antd"
import { IComputingNodeStatus } from "@probe-x/shared-types/src"
import MetricCard from "@components/MetricCard"
import * as styles from "./styles.module.scss"

interface ComputingNodeStatusProps {
  computingNodeStatus: IComputingNodeStatus;
}

function ComputingNodeStatus({ computingNodeStatus }: ComputingNodeStatusProps) {
  const { token } = theme.useToken()

  return (
    <div>
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={6}>
          <MetricCard
            title="总节点数"
            value={computingNodeStatus.totalNodes}
            precision={0}
            status="good"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="在线节点"
            value={computingNodeStatus.onlineNodes}
            precision={0}
            valueStyle={{ color: token.colorSuccess }}
            status="good"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="离线节点"
            value={computingNodeStatus.offlineNodes}
            precision={0}
            valueStyle={{ color: token.colorError }}
            status="critical"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="在线率"
            value={computingNodeStatus.onlineRate}
            suffix="%"
            precision={2}
            status="good"
          />
        </Col>
      </Row>
      <Divider />
      <Row gutter={16} className={styles.metricGroup}>
        <Col span={6}>
          <MetricCard
            title="CPU使用率"
            value={computingNodeStatus.cpuUsage}
            suffix="%"
            precision={1}
            status="warning"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="内存使用率"
            value={computingNodeStatus.memoryUsage}
            suffix="%"
            precision={1}
            status="warning"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="平均负载"
            value={computingNodeStatus.avgLoad}
            precision={2}
            status="good"
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="网络流量"
            value={computingNodeStatus.networkTraffic}
            suffix="Gbps"
            precision={2}
            status="good"
          />
        </Col>
      </Row>
    </div>
  )
}

export default memo(ComputingNodeStatus)
