import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Segmented, Switch, Tag } from 'antd'
import { ArrowLeft } from '@icon-park/react'
import PageHeader from '@components/PageHeader'
import { useInterval } from '@/hooks'
import type { NodeLogEntry, NodeLogLevel } from '@probe-x/shared-types/src'
import { getComputingNodeLogs } from '../../services'
import { secondsAgo } from '../../utils'
import * as styles from './styles.module.scss'

/** 轮询间隔，与节点侧 2s 上行冲刷错开半拍即可 */
const POLL_INTERVAL_MS = 3000
/** 单次拉取的最近日志条数 */
const FETCH_LIMIT = 500

type LevelFilter = 'all' | 'log' | 'warn' | 'error' | 'debug'

const LEVEL_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '信息', value: 'log' },
  { label: '警告', value: 'warn' },
  { label: '错误', value: 'error' },
  { label: '调试', value: 'debug' },
]

/** 「信息」档把 log 与 info 都算上（NestJS Logger.log 底层走 console.log，捕获为 log） */
const matchLevel = (entry: NodeLogEntry, filter: LevelFilter): boolean => {
  if (filter === 'all') return true
  if (filter === 'log') return entry.level === 'log' || entry.level === 'info'
  return entry.level === filter
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/** 「2026-10-14 12:30:15.123」 */
const formatLogTime = (ts: number): string => {
  const date = new Date(ts)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

const LEVEL_CLASS: Record<NodeLogLevel, string> = {
  log: '',
  info: '',
  warn: 'levelWarn',
  error: 'levelError',
  debug: 'levelDebug',
}

const ComputingNodeLogs: React.FC = () => {
  const { nodeId = '' } = useParams<{ nodeId: string }>()
  const navigate = useNavigate()

  const [entries, setEntries] = useState<NodeLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [followLatest, setFollowLatest] = useState(true)

  const panelRef = useRef<HTMLDivElement>(null)
  // 「当前最新一条」的指纹，用于判断本轮轮询有没有新日志，没有就不动滚动条
  const lastFingerprint = useRef('')

  const fetchLogs = useCallback(async () => {
    if (!nodeId) return
    try {
      setLoading(true)
      const res = await getComputingNodeLogs(nodeId, FETCH_LIMIT)
      setEntries(res.data.entries || [])
      setFetchedAt(Date.now())
      setError('')
    } catch (e: any) {
      // 轮询失败沿用上次数据，只更新提示
      setError(e?.msg || e?.message || '日志拉取失败')
    } finally {
      setLoading(false)
    }
  }, [nodeId])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useInterval(fetchLogs, POLL_INTERVAL_MS)

  const filtered = useMemo(
    () => entries.filter((entry) => matchLevel(entry, levelFilter)),
    [entries, levelFilter],
  )

  // 有新日志且开启「跟随最新」时滚到底部
  useEffect(() => {
    const last = filtered[filtered.length - 1]
    const fingerprint = last ? `${last.ts}:${filtered.length}` : ''
    if (!followLatest || fingerprint === lastFingerprint.current) return
    lastFingerprint.current = fingerprint
    const panel = panelRef.current
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [filtered, followLatest])

  return (
    <div className={styles.container}>
      <PageHeader
        title={`计算节点日志 - ${nodeId}`}
        onRefresh={fetchLogs}
        loading={loading}
        extra={
          <div className={styles.headerExtra}>
            {fetchedAt && (
              <span className={styles.metaText}>最近更新：{secondsAgo(fetchedAt, Date.now())}</span>
            )}
            <Button
              icon={<ArrowLeft style={{ display: 'flex' }} theme="outline" size="14" fill="currentColor" />}
              onClick={() => navigate('/system-data/computingNode')}
            >
              返回计算节点
            </Button>
          </div>
        }
      />

      <div className={styles.toolbar}>
        <Segmented
          options={LEVEL_OPTIONS}
          value={levelFilter}
          onChange={(value) => setLevelFilter(value as LevelFilter)}
        />
        <div className={styles.toolbarRight}>
          <span className={styles.metaText}>共 {filtered.length} 条</span>
          <span className={styles.metaText}>跟随最新</span>
          <Switch size="small" checked={followLatest} onChange={setFollowLatest} />
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}（展示最近一次拉取成功的数据）</div>}

      <div ref={panelRef} className={styles.logPanel}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {loading ? '日志加载中…' : '暂无日志。节点上线后会自动上报运行日志。'}
          </div>
        ) : (
          filtered.map((entry, index) => (
            <div key={`${entry.ts}-${index}`} className={styles.logRow}>
              <span className={styles.logTime}>[{formatLogTime(entry.ts)}]</span>
              <Tag className={styles.logLevel} color={levelTagColor(entry.level)}>
                {entry.level.toUpperCase()}
              </Tag>
              <span className={`${styles.logMessage} ${LEVEL_CLASS[entry.level] ? styles[LEVEL_CLASS[entry.level]] : ''}`}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const levelTagColor = (level: NodeLogLevel): string => {
  switch (level) {
    case 'error':
      return 'red'
    case 'warn':
      return 'gold'
    case 'debug':
      return 'purple'
    default:
      return 'blue'
  }
}

export default ComputingNodeLogs
