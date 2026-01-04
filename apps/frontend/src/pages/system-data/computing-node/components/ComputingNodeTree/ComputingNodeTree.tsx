import React from "react"
import { useNavigate } from "react-router-dom"
import * as styles from './styles.module.scss'

// 定义节点类型
export type NodeStatus = 'healthy_idle' | 'healthy_busy' | 'error' | 'offline';
export type NodeType = 'root' | 'child';

export interface ComputingNode {
  id: string;
  name: string;
  status: NodeStatus;
  type: NodeType;
  children?: ComputingNode[];
}

// 状态颜色映射 - 用于灯光指示
const statusLightColorMap: Record<NodeStatus, string> = {
  healthy_idle: '#4ade80',    // 绿色灯光 - 健康空闲
  healthy_busy: '#fbbf24',    // 黄色灯光 - 健康忙碌
  error: '#f87171',          // 红色灯光 - 错误
  offline: '#9ca3af',         // 灰色灯光 - 离线
}

interface ComputingNodeTreeProps {
  nodes: ComputingNode[];
  onNodeClick?: (nodeId: string) => void;
}

const ComputingNodeTree: React.FC<ComputingNodeTreeProps> = ({ nodes, onNodeClick }) => {
  const navigate = useNavigate()

  // 根节点默认存在，使用固定数据
  const rootNode: ComputingNode = {
    id: 'root',
    name: '主节点',
    status: 'healthy_idle',
    type: 'root',
  };

  // 子节点为传入的节点数组
  const childNodes = nodes;

  // SVG 画布尺寸
  const svgWidth = 1000
  const svgHeight = 600

  // 根节点位置
  const rootX = svgWidth / 2
  const rootY = 100

  // 子节点位置计算
  const childSpacing = childNodes.length > 0 ? svgWidth / (childNodes.length + 1) : svgWidth / 2;

  // 点击节点处理函数
  const handleNodeClick = (nodeId: string) => {
    // 如果提供了自定义点击处理函数，则使用它
    if (onNodeClick) {
      onNodeClick(nodeId)
    } else {
      // 默认跳转到节点日志页面
      navigate(`/system-data/computing-node/${nodeId}/logs`)
    }
  }

  // 绘制服务器图标组件
  const drawServerIcon = (x: number, y: number, status: NodeStatus, name: string, isRoot: boolean) => {
    // 服务器主体尺寸
    const serverWidth = isRoot ? 60 : 50
    const serverHeight = isRoot ? 80 : 70
    const cornerRadius = 8
    
    // 计算位置
    const serverX = x - serverWidth / 2
    const serverY = y - serverHeight / 2
    
    // 状态指示灯位置
    const lightRadius = isRoot ? 6 : 5
    const lightX = x
    const lightY = serverY + lightRadius + 4
    
    // 离线状态的透明度
    const opacity = status === 'offline' ? 0.5 : 1

    return (
      <g opacity={opacity}>
        {/* 服务器主体 - 带有渐变效果的矩形 */}
        <rect
          x={serverX}
          y={serverY}
          width={serverWidth}
          height={serverHeight}
          rx={cornerRadius}
          ry={cornerRadius}
          fill="#1f2937" // 深灰色背景
          stroke={status === 'offline' ? "#9ca3af" : "#4b5563"} // 离线时使用灰色边框
          strokeWidth="2"
        />
        
        {/* 服务器面板细节 */}
        <rect
          x={serverX + 5}
          y={serverY + 20}
          width={serverWidth - 10}
          height={serverHeight - 35}
          rx="4"
          ry="4"
          fill="#111827" // 更深的内部面板
          stroke="#374151"
          strokeWidth="1"
        />
        
        {/* 服务器面板网格线 */}
        {Array.from({ length: 4 }).map((_, i) => (
          <line
            key={i}
            x1={serverX + 8}
            y1={serverY + 25 + i * 12}
            x2={serverX + serverWidth - 8}
            y2={serverY + 25 + i * 12}
            stroke="#374151"
            strokeWidth="1"
          />
        ))}
        
        {/* 状态指示灯 - 圆形徽章 */}
        <circle
          cx={lightX}
          cy={lightY}
          r={lightRadius + 2}
          fill="#111827" // 深色背景圈
          stroke={status === 'offline' ? "#9ca3af" : "#374151"}
          strokeWidth="2"
        />
        <circle
          cx={lightX}
          cy={lightY}
          r={lightRadius}
          fill={statusLightColorMap[status]}
          stroke="#ffffff"
          strokeWidth="1"
          className={status !== 'offline' ? styles.blinkingLight : undefined} // 仅在线和活动状态下闪烁
        />
        
        {/* 节点名称 - 在服务器下方 */}
        <text
          x={x}
          y={y + (isRoot ? 55 : 50)} // 在服务器下方，增加偏移量确保可见
          textAnchor="middle"
          fill={status === 'offline' ? '#9ca3af' : '#d1d5db'} // 根据状态调整文字颜色
          fontSize={isRoot ? "12" : "10"}
          fontWeight="500"
        >
          {name}
        </text>

        {/* 如果是离线状态，在服务器上添加斜杠 */}
        {status === 'offline' && (
          <g>
            <line
              x1={serverX + 8}
              y1={serverY + 8}
              x2={serverX + serverWidth - 8}
              y2={serverY + serverHeight - 8}
              stroke="#ef4444"
              strokeWidth="3"
            />
          </g>
        )}
      </g>
    )
  }

  return (
    <div className={styles.computingNodeTreeContainer}>
      <svg width={svgWidth} height={svgHeight}>
        {/* 绘制连接线 */}
        {childNodes.map((node, index) => {
          const childX = childSpacing * (index + 1)
          const childY = 400

          // 如果节点离线，绘制带斜杠的连线
          if (node.status === 'offline') {
            // 贝塞尔曲线路径
            const pathData = `M ${rootX} ${rootY + 40} C ${rootX} ${rootY + 100}, ${childX} ${childY - 100}, ${childX} ${childY - 40}`

            // 主连线
            return (
              <g key={`connection-${node.id}`}>
                <path
                  d={pathData}
                  stroke="#9ca3af"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="5,5" // 离线节点使用虚线
                />
              </g>
            )
          } else {
            // 正常连线
            const pathData = `M ${rootX} ${rootY + 40} C ${rootX} ${rootY + 100}, ${childX} ${childY - 100}, ${childX} ${childY - 40}`
            return (
              <path
                key={`connection-${node.id}`}
                d={pathData}
                stroke="#d1d5db"
                strokeWidth="2"
                fill="none"
              />
            )
          }
        })}

        {/* 绘制根节点 */}
        <g
          key={rootNode.id}
          onClick={() => handleNodeClick(rootNode.id)}
          className={styles.clickableNode}
        >
          {drawServerIcon(rootX, rootY, rootNode.status, rootNode.name, true)}
        </g>

        {/* 绘制子节点 */}
        {childNodes.map((node, index) => {
          const childX = childSpacing * (index + 1)
          const childY = 400

          return (
            <g
              key={node.id}
              onClick={() => handleNodeClick(node.id)}
              className={styles.clickableNode}
            >
              {drawServerIcon(childX, childY, node.status, node.name, false)}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default ComputingNodeTree