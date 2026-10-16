import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Descriptions, Row, Tag, Tooltip, theme } from 'antd'
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
  formatSpeed,
  linkLabelMap,
  resolveNodeLight,
  secondsAgo,
  statusLightColorMap,
  statusLightLabelMap,
} from '@pages/system-data/computing-node/utils'
import * as styles from './styles.module.scss'

/** 拓扑自动刷新间隔 */
const POLL_INTERVAL_MS = 5000

function formatHealthListener(host?: string, port?: number): string {
  if (!host?.trim() || typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) return '—'
  const address = host.trim()
  return `${address.includes(':') && !address.startsWith('[') ? `[${address}]` : address}:${port}`
}

function isLocalHealthListener(host?: string): boolean {
  const address = host?.trim().replace(/^\[|\]$/g, '').toLowerCase()
  return address === 'localhost' || address === '::1' || address === '0:0:0:0:0:0:0:1'
    || /^127(?:\.\d{1,3}){3}$/.test(address || '') || /^::ffff:127(?:\.\d{1,3}){3}$/.test(address || '')
}

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
      <div>并发任务：{node.activeTaskCount ?? (node.busy ? 1 : 0)} / {node.taskCapacity ?? 1}</div>
      {node.busy && node.busyTaskId && <div>当前任务：{node.busyTaskId}</div>}
      {node.busy && <div>实时速度：{formatSpeed(node.cleaningSpeed?.current)}</div>}
    </div>
  )
}

/** 节点详情卡 */
const NodeDetail: React.FC<{ node: IComputeNodeLinkInfo; now: number }> = ({ node, now }) => {
  const light = resolveNodeLight(node)
  const taskIds = node.busyTaskIds ?? (node.busyTaskId ? [node.busyTaskId] : [])
  const healthListener = formatHealthListener(node.healthHost, node.healthPort)

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
      <Descriptions.Item label="节点 IP / 地址"><span style={{ overflowWrap: 'anywhere' }}>{node.nodeAddress || '—'}</span></Descriptions.Item>
      <Descriptions.Item label="健康检查端口">
        {typeof node.nodePort === 'number' && Number.isInteger(node.nodePort) && node.nodePort >= 1 && node.nodePort <= 65535 ? node.nodePort : '—'}
      </Descriptions.Item>
      <Descriptions.Item label="健康监听">
        <span style={{ overflowWrap: 'anywhere' }}>{healthListener}</span>
        {healthListener !== '—' && isLocalHealthListener(node.healthHost)
          && <Tag style={{ marginInlineStart: 8 }}>仅本机访问</Tag>}
      </Descriptions.Item>
      <Descriptions.Item label="节点类型">{node.nodeType}</Descriptions.Item>
      <Descriptions.Item label="最近心跳">{secondsAgo(node.lastHeartbeat, now)}</Descriptions.Item>
      <Descriptions.Item label="链接时长">
        {formatDuration(node.connectedAt, now)}
      </Descriptions.Item>
      <Descriptions.Item label="CPU">{node.cpuCount ? `${node.cpuCount} 核` : '—'}</Descriptions.Item>
      <Descriptions.Item label="并发任务">
        {node.activeTaskCount ?? (node.busy ? 1 : 0)} / {node.taskCapacity ?? 1}
      </Descriptions.Item>
      <Descriptions.Item label="内存">
        {formatMemory(node.availableMemorySize, node.memorySize)}
      </Descriptions.Item>
      <Descriptions.Item label="当前任务">
        {node.busy && taskIds.length > 0
          ? <div style={{ maxHeight: 160, overflowY: 'auto', overflowWrap: 'anywhere' }}>
            {taskIds.map(taskId => <div key={taskId}>{taskId}</div>)}
          </div>
          : node.busy ? '执行中' : '空闲'}
      </Descriptions.Item>
      <Descriptions.Item label={
        <Tooltip title="近6秒所有任务处理事件的合计速度。任务刚开始时可为0，空闲时显示横线。">
          <span>实时速度</span>
        </Tooltip>
      }>
        {node.busy ? formatSpeed(node.cleaningSpeed?.current) : '—'}
      </Descriptions.Item>
      <Descriptions.Item label={
        <Tooltip title="今日所有任务的总处理量除以节点忙碌时长；并发任务的重叠时间只计一次，空闲时间不计入。">
          <span>今日平均速度</span>
        </Tooltip>
      }>
        {formatSpeed(node.cleaningSpeed?.avg)}
      </Descriptions.Item>
      <Descriptions.Item label={
        <Tooltip title="今日节点约每秒采样的最高合计处理速度，首尾不足一秒时按实际忙碌时长计算。">
          <span>今日最快速度</span>
        </Tooltip>
      }>
        {formatSpeed(node.cleaningSpeed?.max)}
      </Descriptions.Item>
      <Descriptions.Item label={
        <Tooltip title="今日节点约每秒采样的最低合计处理速度，首尾按实际时长计算；忙碌但没有处理进度时可为0。">
          <span>今日最慢速度</span>
        </Tooltip>
      }>
        {formatSpeed(node.cleaningSpeed?.min)}
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
