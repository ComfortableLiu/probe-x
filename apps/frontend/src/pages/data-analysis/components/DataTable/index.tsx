import React, { memo, useMemo } from "react"
import TableComponent from "@components/TableComponent"
import { useModel } from "@/hooks"
import { TableProps, theme } from "antd"
import dayjs from "dayjs"
import * as styles from "./styles.module.scss"
import type { GenericEventAnalysisResult, IAnyObj, IEventAnalysisReq } from "@probe-x/shared-types/src"

// 表格依赖事件分析模型的 data 结构
type IModelName = 'dataAnalysisEventModel'

// 表格仅依赖查询参数中的这三个字段
type ITableQuery = Pick<IEventAnalysisReq, 'timeRange' | 'dimension' | 'eventInfoList'>

interface IDataTableModelState {
  data?: GenericEventAnalysisResult[]
  // 本次查询使用的参数快照：表格据此渲染，避免配置项变更后结果区实时跟随
  querySnapshot?: ITableQuery
}

interface IDataTableProps {
  // 数据模型名：事件分析页传 dataAnalysisEventModel
  modelName: IModelName
}

function DataTable(props: IDataTableProps) {
  const { modelName } = props

  const { token } = theme.useToken()

  const {
    data,
    querySnapshot,
  } = useModel<IDataTableModelState>(modelName)

  const timeRange = querySnapshot?.timeRange
  const dimension = useMemo(() => querySnapshot?.dimension || [], [querySnapshot])
  const eventInfoList = useMemo(() => querySnapshot?.eventInfoList || [], [querySnapshot])

  // 「总体」维度在参数中是空字符串，渲染列时需要过滤掉
  const validDimension = useMemo(() => dimension.filter(item => typeof item === 'string' && item.trim()), [dimension])

  // 校验 timeRange 合法性：非法或跨度超过 366 天时回退为最近 7 天，避免生成过多日期列
  const validTimeRange = useMemo(() => {
    const [start, end] = timeRange || []
    const startDay = dayjs(start)
    const endDay = dayjs(end)
    const isValid = !!start && !!end && startDay.isValid() && endDay.isValid() && !endDay.isBefore(startDay)
    if (!isValid || endDay.diff(startDay, 'day') > 366) {
      return [dayjs().subtract(6, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
    }
    return [start, end]
  }, [timeRange])

  // 这里需要处理，把嵌套的数据解开成为一行一行的数据
  const dataSource = useMemo(() => {
    if (!timeRange?.[0] || !timeRange?.[1] || !eventInfoList?.length) return []

    const [startDate, endDate] = validTimeRange

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
        validDimension.forEach((dimKey) => {
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
  }, [validTimeRange, eventInfoList, data, validDimension, timeRange])

  /**
   * 计算每个维度的自动合并规则
   */
  const calculateMergeRules = useMemo<Record<string, number[]>>(() => {
    {
      const mergeRules: Record<string, number[]> = {}

      validDimension.forEach((dimKey) => {
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
  }, [dataSource, validDimension])

  const columns = useMemo<TableProps['columns']>(() => {
    const list: TableProps['columns'] = []
    // 维度列表
    list.push(...validDimension.map(item => {
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
              backgroundColor: token.colorPrimary,
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
    for (let i = dayjs(validTimeRange[0]); !i.isAfter(validTimeRange[1]); i = i.add(1, 'day')) {
      list.push({
        title: dayjs(i).format('YYYY-MM-DD'),
        dataIndex: dayjs(i).format('YYYY-MM-DD'),
        width: 150,
      })
    }

    return list
  }, [calculateMergeRules, validDimension, eventInfoList.length, validTimeRange, token.colorPrimary])

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
    <div className={styles.container}>
      <h3>表格展示</h3>
      {renderTable}
    </div>
  )
}

export default memo(DataTable)
