import React, { memo } from "react"
import { useModel } from "@/hooks"
import { IDataAnalysisAttributionState } from "@pages/data-analysis/attribution/type"
import * as styles from "./styles.module.scss"
import { Table } from "antd"

function DataTable() {

  const {
    data,
  } = useModel<IDataAnalysisAttributionState>('dataAnalysisAttributionModel')

  // 生成表格列
  const generateColumns = () => {
    if (!data?.tableHeader) return []

    const { firstHeader, secondHeader } = data.tableHeader

    // 第一行表头
    const firstLevelHeaders = [
      {
        title: firstHeader.touchPoint,
        children: secondHeader.touchPointHeaders.map((title, index) => {
          // 确定dataIndex
          let dataIndex
          if (index === 0) {
            // 归因事件
            dataIndex = ['touchPointData', 'attributionEventName']
          } else if (index === secondHeader.touchPointHeaders.length - 2) {
            // 归因事件总次数
            dataIndex = ['touchPointData', 'total_count']
          } else if (index === secondHeader.touchPointHeaders.length - 1) {
            // 归因事件用户数
            dataIndex = ['touchPointData', 'user_count']
          } else {
            // 中间的维度字段，需要根据标题查找对应的数据字段
            // 标题可能是 "device_id"，对应的数据字段是 "$device_id"
            const dimensionKey = `$${title}`
            dataIndex = ['touchPointData', dimensionKey]
          }

          return {
            title,
            dataIndex,
            key: `touchPoint_${index}`,
            render: (text: any) => text ?? '-',
          }
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
          render: (value: any, record: any) => {
            if (index === 0) {
              // 转化指标
              return value?.toFixed(2) ?? '-'
            } else if (index === 1) {
              // 转化率（后端返回的已经是百分比了，不需要再乘100）
              return value ? `${value.toFixed(2)}%` : '-'
            } else {
              // 贡献度 - 显示百分比和进度条
              const rate = value?.rate ?? 0
              const progress = value?.progress ?? 0
              return (
                <div>
                  <div>{rate ? `${rate.toFixed(2)}%` : '-'}</div>
                  <div style={{ width: '100%', height: 8, backgroundColor: '#f5f5f5', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{
                      width: `${progress}%`,
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
      },
    ]

    return firstLevelHeaders
  }

  return (
    <div className={styles.container}>
      <h3>表格展示</h3>
      <Table
        dataSource={data?.tableData}
        columns={generateColumns()}
        pagination={false}
        scroll={{ x: "max-content" }}
      />
    </div>
  )
}

export default memo(DataTable)
