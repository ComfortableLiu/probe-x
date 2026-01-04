import React, { useState } from "react"
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
  const [nodes] = useState<ComputingNode[]>([
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

  return (
    <div className={styles.computingNodePage}>
      <h2 className={styles.pageTitle}>计算节点</h2>
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
