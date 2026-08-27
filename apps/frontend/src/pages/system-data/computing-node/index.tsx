import React, { useState } from "react"
import { Tag } from "antd"
import PageHeader from "@components/PageHeader"
import ComputingNodeTree, {
  ComputingNode,
} from "@pages/system-data/computing-node/components/ComputingNodeTree/ComputingNodeTree"
import * as styles from './styles.module.scss'

// 定义节点类型
type NodeStatus = 'healthy_idle' | 'healthy_busy' | 'error' | 'offline';

// 状态颜色映射 - 用于状态说明
const statusLightColorMap: Record<NodeStatus, string> = {
  healthy_idle: '#4ade80',    // 绿色灯光 - 健康空闲
  healthy_busy: '#fbbf24',    // 黄色灯光 - 健康忙碌
  error: '#f87171',          // 红色灯光 - 错误
  offline: '#9ca3af',         // 灰色灯光 - 离线
}

const ComputingNode: React.FC = () => {
  // 模拟计算节点数据 - 不包括根节点，根节点默认存在
  const [nodes, setNodes] = useState<ComputingNode[]>([
    {
      id: 'node1',
      name: '计算节点1',
      status: 'healthy_idle',
      type: 'child',
    },
    {
      id: 'node2',
      name: '计算节点2',
      status: 'healthy_busy',
      type: 'child',
    },
    {
      id: 'node3',
      name: '计算节点3',
      status: 'error',
      type: 'child',
    },
    {
      id: 'node4',
      name: '计算节点4',
      status: 'offline',
      type: 'child',
    },
  ])

  // 刷新数据
  const handleRefresh = () => {
    // TODO: 当有数据获取方法时，在这里调用
    // 目前是静态数据，刷新时重新设置状态以触发重新渲染
    setNodes([...nodes])
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="计算节点"
        onRefresh={handleRefresh}
        extra={<Tag color="warning">功能建设中，当前为演示数据</Tag>}
      />
      <ComputingNodeTree nodes={nodes} />

      {/* 状态说明 */}
      <div className={styles.statusLegend}>
        <div className={styles.legendItem}>
          <div
            className={`${styles.legendLight} ${styles.healthyIdle}`}
          />
          <span>健康空闲</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={`${styles.legendLight} ${styles.healthyBusy}`}
          />
          <span>健康忙碌</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={`${styles.legendLight} ${styles.error}`}
          />
          <span>错误</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={`${styles.legendLight} ${styles.offline}`}
          />
          <span>离线</span>
        </div>
      </div>
    </div>
  )
}

export default ComputingNode
