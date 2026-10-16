import React, { memo, useCallback, useMemo } from "react"
import * as styles from "./styles.module.scss"
import { useLoading, useModel } from "@/hooks"
import { IDataAnalysisRetentionState } from "@pages/data-analysis/retention/type"
import { Table } from "antd"
import ChartContainer from "@components/ChartContainer"
import type { EChartsOption } from "echarts"
import { IRetentionCohortData, RetentionGranularity } from "@probe-x/shared-types/src"
import dayjs from "dayjs"

function DataChat() {

  // 使用查询参数快照渲染，避免修改筛选配置后结果区实时跟随变化（需点击「查询」才更新）
  const {
    data,
    querySnapshot,
  } = useModel<IDataAnalysisRetentionState>('dataAnalysisRetentionModel')

  const loading = useLoading()

  // 留存窗口按升序展示
  const windows = useMemo(() => [...(querySnapshot?.retentionWindows || [])].sort((a, b) => a - b), [querySnapshot])

  // 窗口单位跟随时间粒度：第 N 日 / 第 N 周 / 第 N 月
  const unitLabel = useMemo(() => {
    if (querySnapshot?.granularity === RetentionGranularity.WEEK) return '周'
    if (querySnapshot?.granularity === RetentionGranularity.MONTH) return '月'
    return '日'
  }, [querySnapshot])
  const dayjsUnit = useMemo<'day' | 'week' | 'month'>(() => {
    if (querySnapshot?.granularity === RetentionGranularity.WEEK) return 'week'
    if (querySnapshot?.granularity === RetentionGranularity.MONTH) return 'month'
    return 'day'
  }, [querySnapshot])

  // 维度列（过滤掉「总体」空值）
  const dimensions = useMemo(() => (querySnapshot?.dimension || []).filter(Boolean), [querySnapshot])

  const cohorts = useMemo(() => data?.cohorts || [], [data])

  // 未成熟窗口：队列日期 + N 个粒度单位 > 今天，该窗口的数据尚未积累完整
  const isWindowImmature = useCallback((cohortDate: string, day: number) => {
    return dayjs(cohortDate).add(day, dayjsUnit).isAfter(dayjs(), 'day')
  }, [dayjsUnit])

  // 所有已成熟单元格中的最大留存率，用于蓝色色阶归一化
  const maxRate = useMemo(() => cohorts.reduce((max, cohort) => cohort.windows.reduce((value, item) => {
    if (isWindowImmature(cohort.cohortDate, item.day)) return value
    return Math.max(value, item.retentionRate)
  }, max), 0), [cohorts, isWindowImmature])

  // 留存曲线：x 轴为各留存窗口，默认展示平均留存率
  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!data?.summary.avgRetentionRates.length || !windows.length) return null
    const rateMap = new Map(data.summary.avgRetentionRates.map(item => [item.day, item.retentionRate]))
    return {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => `${value}%`,
      },
      toolbox: {
        feature: {
          saveAsImage: {},
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: windows.map(day => `第${day}${unitLabel}`),
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
        },
      },
      series: [{
        name: '加权留存率',
        type: 'line',
        smooth: true,
        data: windows.map(day => rateMap.get(day) ?? 0),
      }],
    }
  }, [data, windows, unitLabel])

  // 留存网格表列
  const columns = useMemo(() => {
    // 有维度时在队列日期前加维度值列
    const dimensionColumns = dimensions.map(dimension => ({
      title: dimension,
      key: `dimension_${dimension}`,
      render: (_: unknown, record: IRetentionCohortData) => record.dimensionValues?.[dimension] || '-',
    }))
    const windowColumns = windows.map(day => ({
      title: `第${day}${unitLabel}留存率`,
      key: `window_${day}`,
      render: (_: unknown, record: IRetentionCohortData) => {
        if (isWindowImmature(record.cohortDate, day)) return '-'
        const windowData = record.windows.find(item => item.day === day)
        if (!windowData) return '-'
        return `${windowData.retentionRate.toFixed(2)}%`
      },
      onCell: (record: IRetentionCohortData) => {
        if (isWindowImmature(record.cohortDate, day) || !maxRate) return {}
        const rate = record.windows.find(item => item.day === day)?.retentionRate ?? 0
        if (!rate) return {}
        // 蓝色色阶：留存率越大颜色越深
        const alpha = Math.max(rate / maxRate, 0.08) * 0.85
        return {
          style: {
            backgroundColor: `rgba(24, 144, 255, ${alpha.toFixed(3)})`,
            color: alpha > 0.5 ? '#FFFFFF' : undefined,
          },
        }
      },
    }))
    return [
      ...dimensionColumns,
      {
        title: '队列日期',
        dataIndex: 'cohortDate',
        key: 'cohortDate',
      },
      {
        title: '队列用户数',
        dataIndex: 'cohortSize',
        key: 'cohortSize',
      },
      ...windowColumns,
    ]
  }, [dimensions, windows, isWindowImmature, maxRate, unitLabel])

  return (
    <div className={styles.container}>
      {/* 留存曲线 */}
      <div className={styles.chartContainer}>
        <ChartContainer
          option={chartOption}
          height={400}
          loading={!!loading.dataAnalysisRetentionModel.submitQuery}
        />
      </div>

      {/* 汇总信息 */}
      {data ? (
        <div className={styles.summary}>
          <span>总用户数：{data.summary.totalUsers}</span>
          {data.summary.avgRetentionRates.map(item => (
            <span key={item.day}>第{item.day}{unitLabel}加权留存率：{item.retentionRate.toFixed(2)}%</span>
          ))}
        </div>
      ) : null}

      {/* 留存网格表 */}
      <Table<IRetentionCohortData>
        bordered
        dataSource={cohorts}
        columns={columns}
        pagination={false}
        scroll={{ x: "max-content" }}
        loading={!!loading.dataAnalysisRetentionModel.submitQuery}
        rowKey={(record) => `${record.cohortDate}_${dimensions.map(dimension => record.dimensionValues?.[dimension] || '').join('_')}`}
      />
    </div>
  )
}

export default memo(DataChat)
