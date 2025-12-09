import React, { memo, useMemo } from "react"
import { useModel } from "@/hooks"
import { IDataAnalysisAttributionState } from "@pages/data-analysis/attribution/type"
import * as styles from "./styles.module.scss"
import { Table } from "antd"

// 创建一个扩展接口来保存行合并信息
interface IAttributionTableRowWithSpan extends Record<string, any> {
  touchPointData: {
    attributionEventName: string;
    [dimensionKey: string]: string | number | null;
    total_count: number;
    user_count: number;
  };
  conversionData: {
    conversionMetric: number;
    conversionRate: number;
    contribution: {
      rate: number;
      progress: number;
    };
  };
  // 行合并配置
  _rowSpanConfig?: {
    [key: string]: number;
  };
}

function DataTable() {

  const {
    data,
  } = useModel<IDataAnalysisAttributionState>('dataAnalysisAttributionModel')

  // 计算行合并
  const processDataWithRowSpan = useMemo((): IAttributionTableRowWithSpan[] => {
    if (!data?.tableData) return []

    // 克隆数据以避免修改原始数据
    const processedData: IAttributionTableRowWithSpan[] = data.tableData.map(item => ({ ...item }))

    // 初始化行合并配置
    processedData.forEach(row => {
      row._rowSpanConfig = {}
    })

    // 获取所有维度键（排除归因事件名、总次数和用户数）
    const dimensionKeys = Object.keys(processedData[0]?.touchPointData || {})
      .filter(key => !['attributionEventName', 'total_count', 'user_count'].includes(key))

    // 逐层计算行合并，从左到右
    const allColumnKeys = ['attributionEventName', ...dimensionKeys, 'total_count', 'user_count']

    // 对每一列计算行合并
    for (let colIndex = 0; colIndex < allColumnKeys.length; colIndex++) {
      const columnKey = allColumnKeys[colIndex]

      let i = 0
      while (i < processedData.length) {
        // 如果当前行在前面的列已经被合并为0，则跳过
        let shouldSkip = false
        for (let prevColIndex = 0; prevColIndex < colIndex; prevColIndex++) {
          const prevColumnKey = allColumnKeys[prevColIndex]
          if (processedData[i]._rowSpanConfig![prevColumnKey] === 0) {
            shouldSkip = true
            break
          }
        }

        if (shouldSkip) {
          i++
          continue
        }

        const currentValue = processedData[i].touchPointData[columnKey]
        let rowSpan = 1
        let j = i + 1

        // 查找连续的相同值，但要考虑前面列的合并情况
        while (j < processedData.length) {
          // 检查前面的所有列是否都相同
          let allPrevMatch = true
          for (let prevColIndex = 0; prevColIndex < colIndex; prevColIndex++) {
            const prevColumnKey = allColumnKeys[prevColIndex]
            const currentPrevValue = processedData[i].touchPointData[prevColumnKey]
            const nextPrevValue = processedData[j].touchPointData[prevColumnKey]

            if (currentPrevValue !== nextPrevValue) {
              allPrevMatch = false
              break
            }
          }

          // 只有当前面的所有列都匹配时，才考虑当前列的合并
          if (allPrevMatch && processedData[j].touchPointData[columnKey] === currentValue) {
            rowSpan++
            j++
          } else {
            break
          }
        }

        // 设置行合并
        if (rowSpan > 1) {
          processedData[i]._rowSpanConfig![columnKey] = rowSpan
          for (let k = i + 1; k < i + rowSpan; k++) {
            processedData[k]._rowSpanConfig![columnKey] = 0
          }
          i = i + rowSpan
        } else {
          i++
        }
      }
    }

    return processedData
  }, [data?.tableData])

  // 生成表格列
  const generateColumns = useMemo(() => {
    if (!data?.tableHeader) return []

    const { firstHeader, secondHeader } = data.tableHeader

    // 第一行表头
    return [
      {
        title: firstHeader.touchPoint,
        children: secondHeader.touchPointHeaders.map((title, index) => {
          // 确定dataIndex
          let dataIndex
          let columnKey = ''

          if (index === 0) {
            // 归因事件
            dataIndex = ['touchPointData', 'attributionEventName']
            columnKey = 'attributionEventName'
          } else if (index === secondHeader.touchPointHeaders.length - 2) {
            // 归因事件总次数
            dataIndex = ['touchPointData', 'total_count']
            columnKey = 'total_count'
          } else if (index === secondHeader.touchPointHeaders.length - 1) {
            // 归因事件用户数
            dataIndex = ['touchPointData', 'user_count']
            columnKey = 'user_count'
          } else {
            // 中间的维度字段，需要根据标题查找对应的数据字段
            // 标题可能是 "device_id"，对应的数据字段是 "$device_id"
            const dimensionKey = `$${title}`
            dataIndex = ['touchPointData', dimensionKey]
            columnKey = dimensionKey
          }

          return {
            title,
            dataIndex,
            key: `touchPoint_${index}`,
            render: (text: any, record: IAttributionTableRowWithSpan) => {
              // 应用行合并
              if (record._rowSpanConfig && record._rowSpanConfig[columnKey] !== undefined) {
                const rowSpan = record._rowSpanConfig[columnKey]
                if (rowSpan === 0) {
                  return {
                    children: text ?? '-',
                    props: { rowSpan: 0 },
                  }
                } else if (rowSpan > 1) {
                  return {
                    children: text ?? '-',
                    props: { rowSpan },
                  }
                }
              }
              return text ?? '-'
            },
          }
        }),
        // 第一行表头文字居左对齐
        onHeaderCell: () => ({
          style: {
            textAlign: 'left' as const,
          },
        }),
      },
      {
        title: firstHeader.conversionEvent,
        children: secondHeader.conversionHeaders.map((title, index) => ({
          title,
          dataIndex: ['conversionData',
            index === 0 ? 'conversionMetric' :
              index === 1 ? 'conversionRate' :
                'contribution'],
          key: `conversion_${index}`,
          render: (value: any) => {
            if (index === 0) {
              // 转化指标
              return (typeof value === 'number') ? value.toFixed(2) : (value ?? '-')
            } else if (index === 1) {
              // 转化率（后端返回的已经是百分比了，不需要再乘100）
              return (typeof value === 'number') ? `${value.toFixed(2)}%` : (value ?? '-')
            } else {
              // 贡献度 - 显示百分比和进度条
              const rate = value?.rate
              const progress = value?.progress
              return (
                <div>
                  <div>{(typeof rate === 'number') ? `${rate.toFixed(2)}%` : (rate ?? '-')}</div>
                  <div style={{
                    width: '100%',
                    height: 8,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 4,
                    overflow: 'hidden',
                    marginTop: 4,
                  }}>
                    <div style={{
                      width: `${typeof progress === 'number' ? progress : 0}%`,
                      height: '100%',
                      backgroundColor: progress > 50 ? '#52c41a' : progress > 20 ? '#1890ff' : '#faad14',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              )
            }
          },
        })),
        // 第一行表头文字居左对齐
        onHeaderCell: () => ({
          style: {
            textAlign: 'left' as const,
          },
        }),
      },
    ]
  }, [data?.tableHeader])

  return (
    <div className={styles.container}>
      <h3>表格展示</h3>
      <Table
        dataSource={processDataWithRowSpan}
        columns={generateColumns}
        pagination={false}
        scroll={{ x: "max-content" }}
        bordered
      />
    </div>
  )
}

export default memo(DataTable)
