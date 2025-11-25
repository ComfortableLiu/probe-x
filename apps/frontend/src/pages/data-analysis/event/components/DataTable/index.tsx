import React, { memo, useMemo } from "react"
import TableComponent from "@components/TableComponent"
import { useModel, useQuery } from "@/hooks"
import { IDataAnalysisEventState, IQuery } from "@pages/data-analysis/event/type"
import { TableProps } from "antd"
import dayjs from "dayjs"
import * as styles from "./styles.module.scss"
import type { IAnyObj } from "@probe-x/shared-types/src"

function DataTable() {

  const {
    timeRange,
    dimension = [],
    eventInfoList = [],
  } = useQuery<IQuery>()

  const {
    data,
  } = useModel<IDataAnalysisEventState>('dataAnalysisEventModel')

  // 这里需要处理，把嵌套的数据解开成为一行一行的数据
  const dataSource = useMemo(() => {
    if (!timeRange?.[0] || !timeRange?.[1] || !eventInfoList?.length) return []

    const [startDate, endDate] = timeRange || []
    if (!startDate || !endDate) return []

    // 1. 生成表格需要的完整日期列表（YYYY-MM-DD格式）
    const dateList: string[] = []
    for (let i = dayjs(startDate); i.isBefore(dayjs(endDate)) || i.isSame(dayjs(endDate)); i = i.add(1, 'day')) {
      dateList.push(i.format('YYYY-MM-DD'))
    }

    // 2. 生成事件别名映射（与SQL生成规则一致）
    const eventAliasMap = eventInfoList.map((info, index) => ({
      alias: `event_${index}_${info.eventName?.replace(/\W+/g, '_') || 'unknown'}`,
      name: info.eventName || 'unknown_event',
      index,
    }))

    // 3. 转换原始数据：按「维度行 + 事件」拆分
    const tableData: IAnyObj[] = [];

    (data || []).forEach((rawRow) => {
      // 每个原始行（维度组合）对应 N 个事件行（N=eventInfoList.length）
      eventAliasMap.forEach(({ alias, name }) => {
        const tableRow = {
          eventName: name, // 事件名称字段
        }

        // 3.1 复制维度字段（如 $device、$element_id）
        dimension.forEach((dimKey) => {
          tableRow[dimKey] = rawRow[dimKey]
        })

        // 3.2 提取当前事件的每日指标值
        dateList.forEach((date) => {
          // 原始数据中的指标字段名：event_xxx_2025_11_05
          const metricKey = `${alias}_${date.replace(/-/g, '_')}`
          tableRow[date] = rawRow[metricKey] || 0 // 无数据时显示0
        })

        tableData.push(tableRow)
      })
    })
    return tableData
  }, [timeRange, eventInfoList, data, dimension])

  /**
   * 步骤2：计算每个维度的自动合并规则（核心）
   * @param tableData 转换后的表格数据
   * @param dimension 维度字段列表
   * @returns 每个维度的合并配置（每行的 rowSpan 值）
   */
  const calculateMergeRules = useMemo<Record<string, number[]>>(() => {
    {
      const mergeRules: Record<string, number[]> = {}

      dimension.forEach((dimKey) => {
        const rowSpans: number[] = []
        if (!dataSource?.length) {
          mergeRules[dimKey] = rowSpans
          return
        }

        // 初始化：第一个值的连续次数为1
        let currentValue = dataSource[0][dimKey]
        let count = 1

        // 遍历所有行，统计连续重复值的次数
        for (let i = 1; i < dataSource.length; i++) {
          const nextValue = dataSource[i][dimKey]
          if (nextValue === currentValue) {
            // 值相同，连续次数+1
            count++
          } else {
            // 值不同，记录上一组的 rowSpan（第一行占 count 行，后续行占 0 行）
            for (let j = i - count; j < i; j++) {
              rowSpans[j] = j === i - count ? count : 0
            }
            // 重置当前值和连续次数
            currentValue = nextValue
            count = 1
          }
        }

        // 处理最后一组数据
        for (let j = dataSource.length - count; j < dataSource.length; j++) {
          rowSpans[j] = j === dataSource.length - count ? count : 0
        }

        mergeRules[dimKey] = rowSpans
      })

      return mergeRules
    }
  }, [dataSource, dimension])

  const columns = useMemo<TableProps['columns']>(() => {
    const list: TableProps['columns'] = []
    // 维度列表，需要合并各个事件
    list.push(...(dimension || []).map(item => {
      return {
        title: item,
        dataIndex: item,
        width: 150,
        onCell: (_: any, i: string | number) => ({
          rowSpan: calculateMergeRules[item][i],
        }),
      }
    }))

    // 事件
    list.push({
      title: '事件名称',
      dataIndex: 'eventName',
      width: 150,
      render: (eventName: string, _, index) => (
        <div key={eventName} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              height: 20,
              width: 20,
              borderRadius: '50%',
              backgroundColor: '#536DFE',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: 12,
            }}
          >
            {String.fromCharCode(65 + (index % eventInfoList.length))}
          </div>
          {eventName}
        </div>
      ),
    })

    // 日期，从timeRange[0]循环到timeRange[1]，每次加1天
    for (let i = dayjs(timeRange?.[0]); i.isBefore(timeRange?.[1]); i = i.add(1, 'day')) {
      list.push({
        title: dayjs(i).format('YYYY-MM-DD'),
        dataIndex: dayjs(i).format('YYYY-MM-DD'),
        width: 150,
      })
    }

    return list
  }, [calculateMergeRules, dimension, eventInfoList.length, timeRange])

  const renderTable = useMemo(() => {
    if (timeRange?.length !== 2) return null
    return (
      <TableComponent
        dataSource={dataSource}
        columns={columns}
        size="middle"
        style={{
          padding: 0,
        }}
        paginationData={{
          total: 0,
          current: 1,
          pageSize: 20,
        }}
      />
    )
  }, [columns, dataSource, timeRange?.length])

  if (!eventInfoList?.length) return null

  return (
    <div className={styles.container}>
      <h3>表格展示</h3>
      {renderTable}
    </div>
  )
}

export default memo(DataTable)
