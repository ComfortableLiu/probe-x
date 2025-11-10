import React, { memo, useMemo } from "react"
import TableComponent from "@components/TableComponent"
import { useQuery } from "@/hooks"
import { IQuery } from "@pages/data-analysis/event/type"
import { TableProps } from "antd"
import dayjs from "dayjs"

function DataTable() {

  const {
    timeRange,
    dimension,
    chartType,
    eventInfoList,
  } = useQuery<IQuery>()

  const pageData = useMemo(() => new Array(Math.floor(Math.random() * 5) + 1)
    .fill(0)
    .map((_, index) => `页面_value_${index}`), [])

  // 延迟数据
  const delayData = useMemo(() => new Array(Math.floor(Math.random() * 5) + 1)
    .fill(0)
    .map((_, index) => `延迟_value_${index}`), [])

  const columns = useMemo<TableProps['columns']>(() => {
    const list: TableProps['columns'] = []
    const rowSpan = [delayData.length * eventInfoList.length, eventInfoList.length]
    // 维度列表，需要合并各个事件
    list.push(...(dimension || []).map((item, index) => {
      return {
        title: item.propertyName,
        dataIndex: item.propertyKey,
        width: 150,
        onCell: (_, i) => ({
          rowSpan: i % rowSpan[index] === 0 ? rowSpan[index] : 0,
        }),
      }
    }))

    // 事件
    list.push({
      title: '事件名称',
      dataIndex: 'eventName',
      width: 150,
      render: (eventName: string, _, index) => (
        <div key={eventName} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '100%',
              backgroundColor: '#536DFE',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
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
  }, [delayData?.length, dimension, eventInfoList?.length, timeRange])

  const dataSource = useMemo(() => {
    if (!timeRange?.[0] || !timeRange?.[1] || !eventInfoList?.length) return []

    const startDate = dayjs(timeRange[0])
    const endDate = dayjs(timeRange[1])

    const dataList = []
    pageData.forEach((page, pageIndex) => {
      delayData.forEach((delay, delayIndex) => {
        eventInfoList.forEach(event => {
          const row: any = {
            aa: page,
            bb: delay,
            eventName: event.eventName,
            page: page,
            delay: delay,
          }
          // 添加日期数据
          for (let date = startDate; date.isBefore(endDate) || date.isSame(endDate); date = date.add(1, 'day')) {
            const dateStr = date.format('YYYY-MM-DD')
            row[dateStr] = Math.floor(Math.random() * 1000)
          }
          dataList.push(row)
        })
      })
    })

    return dataList
  }, [timeRange, eventInfoList, pageData, delayData])

  const renderTable = useMemo(() => {
    if (timeRange?.length !== 2) return null
    return (
      <TableComponent
        dataSource={dataSource}
        columns={columns}
        size="middle"
        paginationData={{
          total: 0,
          current: 1,
          pageSize: 20,
        }}
      />
    )
  }, [columns, dataSource, timeRange?.length])

  return (
    <div>
      <h3>表格展示</h3>
      {renderTable}
    </div>
  )
}

export default memo(DataTable)
