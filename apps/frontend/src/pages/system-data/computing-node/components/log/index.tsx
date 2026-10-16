import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Segmented, Select, Switch, Tag } from 'antd'
import { ArrowLeft } from '@icon-park/react'
import PageHeader from '@components/PageHeader'
import type { IComputeNodeLogsRes, NodeLogEntry, NodeLogLevel } from '@probe-x/shared-types/src'
import { getComputingNodeLogs } from '../../services'
import { secondsAgo } from '../../utils'
import * as styles from './styles.module.scss'

const POLL_INTERVAL_MS = 3000
type LevelFilter = 'all' | 'log' | 'warn' | 'error' | 'debug'
type PageCursor = string | undefined

const LEVEL_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '信息', value: 'log' },
  { label: '警告', value: 'warn' },
  { label: '错误', value: 'error' },
  { label: '调试', value: 'debug' },
]
const PAGE_SIZE_OPTIONS = [50, 100, 200].map(value => ({ value, label: `${value} 条 / 页` }))

interface LogPage {
  scope: string
  entries: NodeLogEntry[]
  pageIndex: number
  cursors: PageCursor[]
  nextCursor: string | null
  hasMore: boolean
  retentionLimit: number | null
  fetchedAt: number | null
}

const emptyPage = (scope: string): LogPage => ({
  scope, entries: [], pageIndex: 0, cursors: [], nextCursor: null,
  hasMore: false, retentionLimit: null, fetchedAt: null,
})
const pad = (value: number, length = 2) => String(value).padStart(length, '0')
const formatLogTime = (ts: number): string => {
  const date = new Date(ts)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}
const LEVEL_CLASS: Record<NodeLogLevel, string> = {
  log: '', info: '', warn: 'levelWarn', error: 'levelError', debug: 'levelDebug',
}
const levelTagColor = (level: NodeLogLevel): string => {
  switch (level) {
    case 'error': return 'red'
    case 'warn': return 'gold'
    case 'debug': return 'purple'
    default: return 'blue'
  }
}

function ComputingNodeLogs() {
  const { nodeId = '' } = useParams<{ nodeId: string }>()
  const navigate = useNavigate()
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [pageSize, setPageSize] = useState(100)
  const [followLatest, setFollowLatest] = useState(true)
  const scope = JSON.stringify([nodeId, levelFilter, pageSize])
  const [page, setPage] = useState<LogPage>(() => emptyPage(scope))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState({ scope, message: '' })
  const [notice, setNotice] = useState({ scope, message: '' })
  // 切节点或筛选时立即隐藏旧范围的数据，不等待 effect 才清理。
  const current = page.scope === scope ? page : emptyPage(scope)
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const requestId = useRef(0)
  const pendingRequest = useRef<number | null>(null)
  const pollRequest = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollToEnd = useRef(false)
  const lastFingerprint = useRef('')

  const loadPage = useCallback(async (
    cursor: PageCursor,
    pageIndex: number,
    cursors: PageCursor[],
    options: { poll?: boolean; scroll?: boolean } = {},
  ) => {
    if (!nodeId || (options.poll && pendingRequest.current !== null)) return
    const id = ++requestId.current
    pendingRequest.current = id
    pollRequest.current = options.poll ? id : null
    const isCurrent = () => requestId.current === id && scopeRef.current === scope
    setLoading(true)
    setError({ scope, message: '' })
    try {
      let data: IComputeNodeLogsRes = (await getComputingNodeLogs(nodeId, { limit: pageSize, cursor, level: levelFilter })).data
      if (!isCurrent()) return
      let targetIndex = pageIndex
      let targetCursors = cursors.slice()
      let reset = false
      if (data.resetRequired) {
        // 留存裁剪/过期后只回最新一次，不能无限重复失效游标。
        if (!cursor) throw new Error('日志分页状态已失效，请稍后刷新')
        data = (await getComputingNodeLogs(nodeId, { limit: pageSize, level: levelFilter })).data
        if (!isCurrent()) return
        if (data.resetRequired) throw new Error('日志分页状态已失效，请稍后刷新')
        targetIndex = 0
        targetCursors = []
        reset = true
      }
      targetCursors[targetIndex] = data.pageCursor || (reset ? undefined : cursor)
      if (data.nextCursor) targetCursors[targetIndex + 1] = data.nextCursor
      else targetCursors = targetCursors.slice(0, targetIndex + 1)
      scrollToEnd.current = !!options.scroll || reset
      setPage({
        scope, entries: data.entries || [], pageIndex: targetIndex, cursors: targetCursors,
        nextCursor: data.nextCursor, hasMore: data.hasMore,
        retentionLimit: data.retentionLimit, fetchedAt: Date.now(),
      })
      setNotice({ scope, message: reset ? '所选历史日志已超出留存范围，已回到最新一页。' : '' })
    } catch (e: any) {
      if (isCurrent()) setError({ scope, message: e?.msg || e?.message || '日志拉取失败' })
    } finally {
      if (isCurrent()) {
        pendingRequest.current = null
        pollRequest.current = null
        setLoading(false)
      }
    }
  }, [nodeId, pageSize, levelFilter, scope])

  useEffect(() => {
    setNotice({ scope, message: '' })
    lastFingerprint.current = ''
    void loadPage(undefined, 0, [], { scroll: true })
    return () => {
      requestId.current += 1
      pendingRequest.current = null
      pollRequest.current = null
    }
  }, [loadPage, scope])

  useEffect(() => {
    if (!followLatest || current.pageIndex !== 0) return
    const timer = setInterval(() => void loadPage(undefined, 0, [], { poll: true }), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [followLatest, current.pageIndex, loadPage])

  useEffect(() => {
    const last = current.entries[current.entries.length - 1]
    const fingerprint = last?.id || (last ? `${last.ts}:${last.level}:${last.message}` : '')
    if (scrollToEnd.current || (followLatest && fingerprint !== lastFingerprint.current)) {
      const panel = panelRef.current
      if (panel) panel.scrollTop = panel.scrollHeight
    }
    scrollToEnd.current = false
    lastFingerprint.current = fingerprint
  }, [current.entries, followLatest])

  const goLatest = () => {
    setFollowLatest(true)
    void loadPage(undefined, 0, [], { scroll: true })
  }
  const pauseFollowing = () => {
    setFollowLatest(false)
    // 已发出的轮询也不能在暂停后替换正在阅读的日志。
    if (pollRequest.current !== null && pollRequest.current === pendingRequest.current) {
      requestId.current += 1
      pendingRequest.current = null
      pollRequest.current = null
      setLoading(false)
    }
  }
  const refresh = () => void loadPage(
    followLatest ? undefined : current.cursors[current.pageIndex],
    current.pageIndex, followLatest ? [] : current.cursors,
  )

  return (
    <div className={styles.container}>
      <PageHeader
        title="计算节点日志"
        className={styles.pageHeader}
        onRefresh={refresh}
        loading={loading}
        extra={
          <div className={styles.headerExtra}>
            {current.fetchedAt && <span className={styles.metaText}>最近更新：{secondsAgo(current.fetchedAt, Date.now())}</span>}
            <Button
              icon={<ArrowLeft style={{ display: 'flex' }} theme="outline" size="14" fill="currentColor" />}
              onClick={() => navigate('/system-data/computingNode')}
            >返回计算节点</Button>
          </div>
        }
      />
      <p className={styles.nodeIdentity}>节点：{nodeId}</p>
      <div className={styles.toolbar}>
        <Segmented options={LEVEL_OPTIONS} value={levelFilter} onChange={value => setLevelFilter(value as LevelFilter)} />
        <div className={styles.toolbarRight}>
          <Select aria-label="每页日志条数" value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
          <span className={styles.metaText}>跟随最新</span>
          <Switch
            aria-label="跟随最新日志"
            size="small"
            checked={followLatest}
            onChange={checked => checked ? goLatest() : pauseFollowing()}
          />
        </div>
      </div>
      {error.scope === scope && error.message && (
        <Alert
          className={styles.banner}
          type="error"
          showIcon
          message={error.message}
          description={current.entries.length ? '已保留当前页数据，可点击刷新重试。' : '请稍后点击刷新重试。'}
        />
      )}
      {notice.scope === scope && notice.message && <Alert className={styles.banner} type="info" showIcon message={notice.message} />}
      <div ref={panelRef} className={styles.logPanel} aria-label="当前页节点日志" aria-busy={loading}>
        {current.entries.length === 0 ? (
          <div className={styles.empty}>
            {loading ? '日志加载中…' : levelFilter === 'all' ? '暂无日志。节点上线后会自动上报运行日志。' : '暂无该级别的日志。'}
          </div>
        ) : current.entries.map((entry, index) => (
          <div key={entry.id || `${entry.ts}-${index}`} className={styles.logRow}>
            <span className={styles.logTime}>[{formatLogTime(entry.ts)}]</span>
            <Tag className={styles.logLevel} color={levelTagColor(entry.level)}>{entry.level.toUpperCase()}</Tag>
            <span className={`${styles.logMessage} ${LEVEL_CLASS[entry.level] ? styles[LEVEL_CLASS[entry.level]] : ''}`}>{entry.message}</span>
          </div>
        ))}
      </div>
      <div className={styles.pagination}>
        <div className={styles.pageStatus}>
          <span aria-live="polite">第 {current.pageIndex + 1} 页 · 本页 {current.entries.length} 条</span>
          <span className={styles.metaText}>{followLatest ? '每 3 秒更新最新一页' : '已暂停跟随最新'} · 本页从旧到新</span>
        </div>
        <div className={styles.pageActions}>
          <Button disabled={loading || current.pageIndex === 0} onClick={() => {
            pauseFollowing()
            void loadPage(current.cursors[current.pageIndex - 1], current.pageIndex - 1, current.cursors, { scroll: true })
          }}>较新一页</Button>
          <Button disabled={loading || !current.hasMore || !current.nextCursor} onClick={() => {
            pauseFollowing()
            void loadPage(current.nextCursor!, current.pageIndex + 1, current.cursors, { scroll: true })
          }}>较早一页</Button>
          <Button disabled={loading} onClick={goLatest}>回到最新</Button>
        </div>
      </div>
      {current.retentionLimit !== null && <p className={styles.retention}>每个节点最多保留最近 {current.retentionLimit.toLocaleString()} 条日志，历史日志按需分页读取。</p>}
    </div>
  )
}

export default ComputingNodeLogs
