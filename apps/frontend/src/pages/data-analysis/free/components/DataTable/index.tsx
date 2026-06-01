import React, { memo, useMemo } from "react"
import TableComponent from "@components/TableComponent"
import { useModel, useQuery } from "@/hooks"
import { IDataAnalysisFreeState, IQuery } from "@pages/data-analysis/free/type"
import { TableProps } from "antd"
import dayjs from "dayjs"
import type { IAnyObj } from "@probe-x/shared-types/src"

function DataTable() {

  const {
    timeRange,
    dimension = [],
    eventInfoList = [],
  } = useQuery<IQuery>()

  const {
    data,
  } = useModel<IDataAnalysisFreeState>('dataAnalysisFreeModel')

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

        // 3.1 复制维度字段
        dimension.forEach((dimKey) => {
          tableRow[dimKey] = rawRow[dimKey]
        })

        // 3.2 提取当前事件的每日指标值
        dateList.forEach((date) => {
          const metricKey = `${alias}_${date.replace(/-/g, '_')}`
          tableRow[date] = rawRow[metricKey] || 0
        })

        tableData.push(tableRow)
      })
    })
    return tableData
  }, [timeRange, eventInfoList, data, dimension])

  /**
   * 计算每个维度的自动合并规则
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

        let currentValue = dataSource[0][dimKey]
        let count = 1

        for (let i = 1; i < dataSource.length; i++) {
          const nextValue = dataSource[i][dimKey]
          if (nextValue === currentValue) {
            count++
          } else {
            for (let j = i - count; j < i; j++) {
              rowSpans[j] = j === i - count ? count : 0
            }
            currentValue = nextValue
            count = 1
          }
        }

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
    // 维度列表
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

    // 日期列
    for (let i = dayjs(timeRange?.[0]); !i.isAfter(timeRange?.[1]); i = i.add(1, 'day')) {
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
        scroll={{ x: 'max-content' }}
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
    <div>
      <h3>表格展示</h3>
      {renderTable}
    </div>
  )
}

export default memo(DataTable)
