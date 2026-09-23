import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Descriptions, Row, Tag, theme } from 'antd'
import { FileSearchOne } from '@icon-park/react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import PageHeader from '@components/PageHeader'
import { useInterval, useModel } from '@/hooks'
import { Dispatch } from '@/store/storeContext'
import ComputingNodeTree, {
  ComputingNode,
} from '@pages/system-data/computing-node/components/ComputingNodeTree/ComputingNodeTree'
import {
  IComputeNodeLinkInfo,
  ISystemDataComputingNodeState,
} from '@pages/system-data/computing-node/type'
import {
  formatDuration,
  formatMemory,
  linkLabelMap,
  resolveNodeLight,
  secondsAgo,
  statusLightColorMap,
  statusLightLabelMap,
} from '@pages/system-data/computing-node/utils'
import * as styles from './styles.module.scss'

/** 拓扑自动刷新间隔 */
const POLL_INTERVAL_MS = 5000

const ComputingNodePage: React.FC = () => {
  const { topology, loading, fetchedAt } = useModel<ISystemDataComputingNodeState>(
    'computingNodeModel',
  )
  const dispatch = useDispatch<Dispatch>()
  const navigate = useNavigate()
  const { token } = theme.useToken()

  // 「最近心跳 x 秒前」要跟着走，单独一个秒级时钟
  const [now, setNow] = useState(() => Date.now())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    dispatch.computingNodeModel.fetchTopology()
  }, [])

  // 节点的链接状态是实时的，定时拉取；useInterval 走 ref，不会反复重挂定时器
  useInterval(() => dispatch.computingNodeModel.fetchTopology(), POLL_INTERVAL_MS)
  useInterval(() => setNow(Date.now()), 1000)

  const nodes = topology?.nodes || []

  // 选中项跟随数据：节点被删掉后回退到第一个
  const selected: IComputeNodeLinkInfo | null = useMemo(() => {
    const hit = nodes.find((item) => item.nodeId === selectedId)
    return hit || nodes[0] || null
  }, [nodes, selectedId])

  const treeNodes: ComputingNode[] = useMemo(
    () =>
      nodes.map((item) => ({
        id: item.nodeId,
        name: item.nodeName,
        status: resolveNodeLight(item),
        type: 'child' as const,
        detail: <NodeTooltip node={item} now={now} />,
      })),
    [nodes, now],
  )

  const root: ComputingNode = {
    id: 'root',
    name: topology?.root?.name || '总服务',
    // 页面能刷出数据即代表总服务自身在跑
    status: 'healthy_idle',
    type: 'root',
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="计算节点"
        onRefresh={() => dispatch.computingNodeModel.fetchTopology()}
        loading={loading}
        extra={
          <div className={styles.headerExtra}>
            <Tag color="blue">
              在线 {topology?.root?.onlineNodes ?? 0} / 共 {topology?.root?.totalNodes ?? 0}
            </Tag>
            <span className={styles.metaText}>
              最近更新：{secondsAgo(fetchedAt, now)}
            </span>
          </div>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <ComputingNodeTree
            root={root}
            nodes={treeNodes}
            selectedId={selected?.nodeId ?? null}
            onNodeClick={(nodeId) => setSelectedId(nodeId)}
          />

          {/* 状态说明 */}
          <div className={styles.statusLegend}>
            <div className={styles.legendItem}>
              <div className={`${styles.legendLight} ${styles.healthyIdle}`} />
              <span>健康空闲</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendLight} ${styles.healthyBusy}`} />
              <span>健康忙碌</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendLight} ${styles.error}`} />
              <span>错误</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendLight} ${styles.offline}`} />
              <span>离线</span>
            </div>
          </div>
        </Col>

        <Col xs={24} xl={7}>
          <Card
            className={styles.detailCard}
            size="small"
            title="节点详情"
            extra={
              selected && (
                <Button
                  type="link"
                  size="small"
                  icon={
                    <FileSearchOne
                      style={{ display: 'flex' }}
                      theme="outline"
                      size="14"
                      fill="currentColor"
                    />
                  }
                  onClick={() => navigate(`/system-data/computing-node/${selected.nodeId}/logs`)}
                >
                  查看日志
                </Button>
              )
            }
            styles={{ body: { background: token.colorBgContainer } }}
          >
            {selected ? (
              <NodeDetail node={selected} now={now} />
            ) : (
              <div className={styles.empty}>暂无已注册的计算节点</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

/** 悬停气泡里的链接摘要 */
const NodeTooltip: React.FC<{ node: IComputeNodeLinkInfo; now: number }> = ({ node, now }) => {
  const light = resolveNodeLight(node)
  return (
    <div className={styles.tooltipBody}>
      <div className={styles.tooltipTitle}>{node.nodeName}</div>
      <div>链接状态：{linkLabelMap[node.link]}</div>
      <div>状态灯：{statusLightLabelMap[light]}</div>
      <div>最近心跳：{secondsAgo(node.lastHeartbeat, now)}</div>
      {node.busy && node.busyTaskId && <div>当前任务：{node.busyTaskId}</div>}
    </div>
  )
}

/** 节点详情卡 */
const NodeDetail: React.FC<{ node: IComputeNodeLinkInfo; now: number }> = ({ node, now }) => {
  const light = resolveNodeLight(node)

  return (
    <Descriptions column={1} size="small" colon={false}>
      <Descriptions.Item label="状态灯">
        <span className={styles.legendItem}>
          <span
            className={`${styles.legendLight} ${lightClass(light)}`}
            style={{ backgroundColor: statusLightColorMap[light] }}
          />
          {statusLightLabelMap[light]}
        </span>
      </Descriptions.Item>
      <Descriptions.Item label="链接状态">{linkLabelMap[node.link]}</Descriptions.Item>
      <Descriptions.Item label="节点 ID">{node.nodeId}</Descriptions.Item>
      <Descriptions.Item label="节点名称">{node.nodeName || '—'}</Descriptions.Item>
      <Descriptions.Item label="节点地址">{node.nodeAddress || '—'}</Descriptions.Item>
      <Descriptions.Item label="节点类型">{node.nodeType}</Descriptions.Item>
      <Descriptions.Item label="最近心跳">{secondsAgo(node.lastHeartbeat, now)}</Descriptions.Item>
      <Descriptions.Item label="链接时长">
        {formatDuration(node.connectedAt, now)}
      </Descriptions.Item>
      <Descriptions.Item label="CPU">{node.cpuCount ? `${node.cpuCount} 核` : '—'}</Descriptions.Item>
      <Descriptions.Item label="内存">
        {formatMemory(node.availableMemorySize, node.memorySize)}
      </Descriptions.Item>
      <Descriptions.Item label="当前任务">
        {node.busy && node.busyTaskId ? node.busyTaskId : node.busy ? '执行中' : '空闲'}
      </Descriptions.Item>
      <Descriptions.Item label="最近错误">
        {node.lastError ? (
          <span className={styles.errorText}>{node.lastError}</span>
        ) : (
          '无'
        )}
      </Descriptions.Item>
    </Descriptions>
  )
}

const lightClass = (light: keyof typeof statusLightLabelMap) => {
  if (light === 'healthy_idle') return styles.healthyIdle
  if (light === 'healthy_busy') return styles.healthyBusy
  return light === 'error' ? styles.error : styles.offline
}

export default ComputingNodePage
