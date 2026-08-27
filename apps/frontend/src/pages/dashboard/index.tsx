import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Empty, message } from "antd"
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import PageHeader from "@components/PageHeader"
import { useQuery, useRouter } from "@/hooks"
import { IDashboard } from "@probe-x/shared-types/src"
import { queryDashboardData, queryDashboardList } from "./services"
import DashboardCard, { IDashboardCardState } from "./components/DashboardCard"
import TimeSelector from "./components/TimeSelector"
import {
  DEFAULT_TIME_SELECTION,
  ICardTimeSetting,
  ITimeSelection,
  parseCardTimeMap,
  parseTimeSelection,
  resolveTimeRange,
} from "./time"
import * as styles from "./styles.module.scss"

// 看板排序的 localStorage key，存看板 id 数组
const ORDER_STORAGE_KEY = 'PROBE-X-dashboard-order'
// 时间选择的 localStorage 镜像 key（URL 无参数进入时据此恢复）
const TIME_STORAGE_KEY = 'PROBE-X-dashboard-time'
// 数据自动轮询间隔
const POLLING_INTERVAL = 60 * 1000

// URL query 参数说明：
// gt = 全局时间选择（ITimeSelection 的 JSON）
// ct = 卡片时间覆盖 map（{ [dashboardId]: ICardTimeSetting } 的 JSON，只存「单独设置」的卡片）

// 读取本地保存的排序
function readStoredOrder(): number[] {
  try {
    const stored = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter(id => typeof id === 'number') : []
  } catch {
    return []
  }
}

// 按本地保存的顺序排列看板，新看板追加到末尾
function sortByStoredOrder(list: IDashboard[]): IDashboard[] {
  const storedOrder = readStoredOrder()
  if (!storedOrder.length) return list
  const dashboardMap = new Map(list.map(item => [item.id, item]))
  const ordered = storedOrder
    .map(id => dashboardMap.get(id))
    .filter((item): item is IDashboard => !!item)
  const newDashboards = list.filter(item => !storedOrder.includes(item.id))
  return [...ordered, ...newDashboards]
}

function DashboardPage() {
  const [dashboards, setDashboards] = useState<IDashboard[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [dataMap, setDataMap] = useState<Record<number, IDashboardCardState>>({})

  const query = useQuery<{ gt?: unknown, ct?: unknown }>()
  const { refresh } = useRouter()

  // 时间状态以 URL 为准：gt/ct 解析失败或缺省时回退默认值
  const urlGlobalTime = useMemo(() => parseTimeSelection(query.gt), [query.gt])
  const urlCardTimeMap = useMemo(() => parseCardTimeMap(query.ct), [query.ct])
  const globalTime = urlGlobalTime || DEFAULT_TIME_SELECTION
  // 过滤掉已删除看板的残留 id
  const cardTimeMap = useMemo(() => {
    const validIds = new Set(dashboards.map(item => item.id))
    const result: Record<number, ICardTimeSetting> = {}
    Object.entries(urlCardTimeMap).forEach(([id, setting]) => {
      if (validIds.has(Number(id))) result[Number(id)] = setting
    })
    return result
  }, [urlCardTimeMap, dashboards])

  // 用 ref 持有最新看板列表和时间状态，供轮询定时器使用，避免重复创建定时器
  const dashboardsRef = useRef<IDashboard[]>([])
  dashboardsRef.current = dashboards
  const timeRef = useRef({ globalTime, cardTimeMap })
  timeRef.current = { globalTime, cardTimeMap }

  // 恢复逻辑只在挂载时执行一次：URL 无时间参数时从 localStorage 恢复并写回 URL
  // 优先级：URL 参数 > localStorage > 默认值
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (parseTimeSelection(query.gt)) return
    try {
      const stored = JSON.parse(localStorage.getItem(TIME_STORAGE_KEY) || 'null')
      const storedGlobalTime = parseTimeSelection(stored?.gt)
      if (storedGlobalTime) {
        const storedCardTimeMap = parseCardTimeMap(stored?.ct)
        // 同步更新 ref，保证紧随其后的首次数据加载（loadDashboards）直接使用恢复的时间，
        // 而不是等 URL 更新后的下一次渲染
        timeRef.current = { globalTime: storedGlobalTime, cardTimeMap: storedCardTimeMap }
        refresh({ gt: storedGlobalTime, ct: storedCardTimeMap }, true)
      }
    } catch {
      // localStorage 数据损坏时忽略，使用默认值
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // URL 上有时间参数时镜像到 localStorage，保证下次无参数进入时恢复上次选择
  useEffect(() => {
    if (!urlGlobalTime) return
    localStorage.setItem(TIME_STORAGE_KEY, JSON.stringify({ gt: globalTime, ct: cardTimeMap }))
  }, [urlGlobalTime, globalTime, cardTimeMap])

  // 获取某个看板当前生效的时间选择（相对时间不在此解析，查询时才解析成具体日期）
  const getEffectiveSelection = useCallback((dashboardId: number): ITimeSelection => {
    const cardTime = timeRef.current.cardTimeMap[dashboardId]
    if (cardTime?.mode === 'custom') return cardTime.selection
    return timeRef.current.globalTime
  }, [])

  // 查询单个看板数据，selectionOverride 用于时间变更后立即用新时间重查（URL 更新是异步的）
  const fetchOne = useCallback(async (dashboard: IDashboard, selectionOverride?: ITimeSelection) => {
    // 已有内容时不展示加载态，避免刷新时打断图表
    setDataMap(prev => ({
      ...prev,
      [dashboard.id]: prev[dashboard.id]?.data || prev[dashboard.id]?.error
        ? { loading: false, ...prev[dashboard.id] }
        : { loading: true },
    }))
    try {
      // 相对时间在查询时动态解析，保证轮询时「近 7 天」始终是新值
      const timeRange = resolveTimeRange(selectionOverride || getEffectiveSelection(dashboard.id))
      const { data } = await queryDashboardData({ dashboardId: dashboard.id, timeRange })
      setDataMap(prev => ({
        ...prev,
        [dashboard.id]: { loading: false, data },
      }))
    } catch (error: any) {
      setDataMap(prev => ({
        ...prev,
        [dashboard.id]: { loading: false, error: error?.message || '数据加载失败' },
      }))
    }
  }, [getEffectiveSelection])

  // 并行查询所有看板数据，单个失败不影响其他
  // globalOverride 用于全局时间变更后立即用新全局时间重查（不影响单独设置了时间的卡片）
  const fetchAllData = useCallback((list: IDashboard[], globalOverride?: ITimeSelection) => {
    list.forEach((dashboard) => {
      const isCustom = timeRef.current.cardTimeMap[dashboard.id]?.mode === 'custom'
      fetchOne(dashboard, isCustom ? undefined : globalOverride)
    })
  }, [fetchOne])

  // 加载看板列表并触发数据查询
  const loadDashboards = useCallback(async () => {
    setListLoading(true)
    try {
      const { data } = await queryDashboardList({ page: 1, pageSize: 100 })
      const list = sortByStoredOrder(data?.list || [])
      setDashboards(list)
      fetchAllData(list)
    } catch {
      message.error('看板列表加载失败')
    } finally {
      setListLoading(false)
    }
  }, [fetchAllData])

  useEffect(() => {
    loadDashboards()
  }, [loadDashboards])

  // 每 60 秒轮询刷新看板数据（使用当前生效的时间），组件卸载时清理定时器
  useEffect(() => {
    const timer = setInterval(() => {
      if (dashboardsRef.current.length) {
        fetchAllData(dashboardsRef.current)
      }
    }, POLLING_INTERVAL)
    return () => clearInterval(timer)
  }, [fetchAllData])

  // 全局时间变更：写 URL（镜像 localStorage 由上面的 effect 完成）并重新查询所有看板
  const handleGlobalTimeChange = useCallback((selection: ITimeSelection) => {
    refresh({ gt: selection, ct: timeRef.current.cardTimeMap }, true)
    fetchAllData(dashboardsRef.current, selection)
  }, [refresh, fetchAllData])

  // 卡片时间变更：写 URL 并只重新查询该看板
  const handleCardTimeChange = useCallback((dashboardId: number, setting: ICardTimeSetting) => {
    const nextMap = { ...timeRef.current.cardTimeMap }
    // 跟随全局与缺省等价，删除该 key 保持 URL 简洁
    if (setting.mode === 'global') {
      delete nextMap[dashboardId]
    } else {
      nextMap[dashboardId] = setting
    }
    refresh({ gt: timeRef.current.globalTime, ct: nextMap }, true)
    const dashboard = dashboardsRef.current.find(item => item.id === dashboardId)
    if (dashboard) {
      fetchOne(dashboard, setting.mode === 'custom' ? setting.selection : timeRef.current.globalTime)
    }
  }, [refresh, fetchOne])

  // 拖拽传感器：移动 4px 后才触发拖拽，避免误触点击
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  )

  // 拖拽结束：更新排序并持久化到 localStorage
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDashboards((prev) => {
      const oldIndex = prev.findIndex(item => item.id === active.id)
      const newIndex = prev.findIndex(item => item.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next.map(item => item.id)))
      return next
    })
  }, [])

  return (
    <div className={styles.dashboardPage}>
      <PageHeader
        title="看板"
        onRefresh={loadDashboards}
        loading={listLoading}
        extra={(
          <TimeSelector
            value={globalTime}
            onChange={handleGlobalTimeChange}
          />
        )}
      />

      {!listLoading && !dashboards.length ? (
        <Empty
          className={styles.empty}
          description="暂无看板，可前往数据分析页查询后「保存为看板」"
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={dashboards.map(item => item.id)}
            strategy={rectSortingStrategy}
          >
            <div className={styles.grid}>
              {dashboards.map((dashboard) => {
                const setting = cardTimeMap[dashboard.id]
                const selection = setting?.mode === 'custom' ? setting.selection : globalTime
                return (
                  <DashboardCard
                    key={dashboard.id}
                    dashboard={dashboard}
                    state={dataMap[dashboard.id]}
                    timeSetting={setting}
                    globalTime={globalTime}
                    effectiveTimeRange={resolveTimeRange(selection)}
                    onTimeChange={handleCardTimeChange}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

export default DashboardPage
