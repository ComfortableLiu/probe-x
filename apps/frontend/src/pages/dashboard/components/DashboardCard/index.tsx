import React, { memo, useMemo, useState } from "react"
import { Alert, Card, message, Popover, Radio, Segmented, Spin, Table, Tag } from "antd"
import { Calendar, Drag, Jump } from "@icon-park/react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useNavigate } from "react-router-dom"
import ChartContainer from "@components/ChartContainer"
import { IDashboard, IDashboardDataRes } from "@probe-x/shared-types/src"
import { ANALYSIS_TYPE_TEXT, buildChartOption, buildDetailUrl, buildTableData } from "../../utils"
import { getTimeSelectionLabel, ICardTimeSetting, ITimeSelection } from "../../time"
import TimeSelector from "../TimeSelector"
import * as styles from "./styles.module.scss"

// 卡片数据状态（由页面组件统一管理）
export interface IDashboardCardState {
  loading: boolean
  error?: string
  data?: IDashboardDataRes
}

interface IDashboardCardProps {
  dashboard: IDashboard
  state?: IDashboardCardState
  /** 卡片时间设置，缺省为跟随全局 */
  timeSetting?: ICardTimeSetting
  /** 全局时间选择（用于「跟随全局」选项的展示） */
  globalTime: ITimeSelection
  /** 当前生效的解析后时间范围（YYYY-MM-DD） */
  effectiveTimeRange: [string, string]
  /** 卡片时间设置变更回调 */
  onTimeChange: (dashboardId: number, setting: ICardTimeSetting) => void
}

// 展示模式
type IDisplayMode = 'chart' | 'table'

function DashboardCard(props: IDashboardCardProps) {
  const {
    dashboard,
    state,
    timeSetting,
    globalTime,
    effectiveTimeRange,
    onTimeChange,
  } = props

  const navigate = useNavigate()

  // 可切换的展示模式：跟随看板的 displayChart/displayTable 配置，两个都没开时兜底都展示
  const modeOptions = useMemo(() => {
    const options: { label: string, value: IDisplayMode }[] = []
    if (dashboard.displayChart) options.push({ label: '图表', value: 'chart' })
    if (dashboard.displayTable) options.push({ label: '表格', value: 'table' })
    if (!options.length) {
      options.push({ label: '图表', value: 'chart' }, { label: '表格', value: 'table' })
    }
    return options
  }, [dashboard.displayChart, dashboard.displayTable])

  // 默认模式：两个都开则默认图表
  const [displayMode, setDisplayMode] = useState<IDisplayMode>(
    dashboard.displayChart || !dashboard.displayTable ? 'chart' : 'table',
  )

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dashboard.id })

  const sortableStyle = useMemo<React.CSSProperties>(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
  }), [transform, transition])

  const chartOption = useMemo(
    () => buildChartOption(dashboard, state?.data, effectiveTimeRange),
    [dashboard, state?.data, effectiveTimeRange],
  )
  const tableData = useMemo(
    () => buildTableData(dashboard, state?.data, effectiveTimeRange),
    [dashboard, state?.data, effectiveTimeRange],
  )

  // 是否单独设置了时间
  const isCustomTime = timeSetting?.mode === 'custom'
  // 当前生效的时间选择（用于切换为「单独设置」时的初始值）
  const effectiveSelection: ITimeSelection = isCustomTime ? timeSetting.selection : globalTime

  // 跳转到对应分析页详情
  const handleGoDetail = () => {
    const url = buildDetailUrl(dashboard)
    if (!url) {
      message.warning('看板配置为空，无法跳转')
      return
    }
    navigate(url)
  }

  // 卡片内容：加载中 / 加载失败 / 图表 / 表格
  const content = useMemo(() => {
    if (state?.loading) {
      return (
        <div className={styles.centerBox}>
          <Spin />
        </div>
      )
    }
    if (state?.error) {
      return (
        <div className={styles.centerBox}>
          <Alert type="warning" showIcon message="数据加载失败" description={state.error} />
        </div>
      )
    }
    if (displayMode === 'chart') {
      return (
        <ChartContainer
          option={chartOption}
          height={300}
          emptyText="暂无数据"
        />
      )
    }
    return (
      <Table
        columns={tableData?.columns || []}
        dataSource={tableData?.dataSource || []}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content', y: 250 }}
        locale={{ emptyText: '暂无数据' }}
      />
    )
  }, [state?.loading, state?.error, displayMode, chartOption, tableData])

  // 时间设置 Popover 内容
  const timePopoverContent = (
    <div className={styles.timePopover}>
      <Radio.Group
        value={isCustomTime ? 'custom' : 'global'}
        onChange={(e) => {
          if (e.target.value === 'global') {
            onTimeChange(dashboard.id, { mode: 'global' })
          } else {
            // 切换为单独设置时，以当前生效的时间作为初始值
            onTimeChange(dashboard.id, { mode: 'custom', selection: effectiveSelection })
          }
        }}
      >
        <Radio value="global">跟随全局（{getTimeSelectionLabel(globalTime)}）</Radio>
        <Radio value="custom">单独设置</Radio>
      </Radio.Group>
      {isCustomTime && (
        <TimeSelector
          value={timeSetting.selection}
          onChange={selection => onTimeChange(dashboard.id, { mode: 'custom', selection })}
        />
      )}
    </div>
  )

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={`${styles.cardWrapper} ${isDragging ? styles.cardDragging : ''}`}
    >
      <Card
        className={styles.card}
        title={(
          <div className={styles.cardTitle}>
            <span className={styles.cardName} title={dashboard.name}>{dashboard.name}</span>
            <Tag>{ANALYSIS_TYPE_TEXT[dashboard.analysisType] || dashboard.analysisType}</Tag>
            {/* 跳转分析详情页 */}
            <span className={styles.iconBtn} title="查看详情" onClick={handleGoDetail}>
              <Jump theme="outline" size="14" fill="currentColor" />
            </span>
          </div>
        )}
        extra={(
          <div className={styles.cardExtra}>
            <Segmented
              size="small"
              options={modeOptions}
              value={displayMode}
              onChange={value => setDisplayMode(value as IDisplayMode)}
            />
            {/* 卡片时间设置 */}
            <Popover
              content={timePopoverContent}
              trigger="click"
              placement="bottomRight"
            >
              <span
                className={`${styles.iconBtn} ${isCustomTime ? styles.iconBtnActive : ''}`}
                title={`时间设置（当前：${effectiveTimeRange[0]} ~ ${effectiveTimeRange[1]}）`}
              >
                <Calendar theme="outline" size="16" fill="currentColor" />
              </span>
            </Popover>
            {/* 拖拽手柄：只在手柄上绑定拖拽事件，避免与图表/表格交互冲突 */}
            <span
              className={styles.dragHandle}
              title="拖拽排序"
              {...attributes}
              {...listeners}
            >
              <Drag theme="outline" size="16" fill="currentColor" />
            </span>
          </div>
        )}
      >
        <div className={styles.cardBody}>
          {content}
        </div>
      </Card>
    </div>
  )
}

export default memo(DashboardCard)
