import React, { memo } from 'react'
import { Card, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { IRealtimeEvent, IRealtimeEventsResponse } from '@probe-x/shared-types/src'
import * as styles from './styles.module.scss'

interface EventTableProps {
  realtimeEvents: IRealtimeEventsResponse
  loading?: boolean
  onRefresh?: () => void
}

function EventTable({ realtimeEvents, loading, onRefresh }: EventTableProps) {
  const columns: ColumnsType<IRealtimeEvent> = [
    {
      title: '事件名称',
      dataIndex: 'eventName',
      key: 'eventName',
      width: 180,
      render: (text: string) => (
        <Tooltip title={text}>
          <span className={styles.eventNameTag}>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '设备ID',
      dataIndex: 'deviceId',
      key: 'deviceId',
      width: 160,
      render: (text: string) => (
        <Tooltip title={text}>
          <span className={styles.deviceId}>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '页面路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span className={styles.pathCell}>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (text: string) => text || '-',
    },
    {
      title: '事件时间',
      dataIndex: 'serviceTime',
      key: 'serviceTime',
      width: 180,
      render: (text: string) => (
        <span className={styles.timeCell}>{text || '-'}</span>
      ),
    },
  ]

  return (
    <Card
      title={
        <div className={styles.tableHeader}>
          <span>实时事件流</span>
          <span className={styles.totalInfo}>
            今日共 {realtimeEvents.total.toLocaleString()} 条事件
          </span>
        </div>
      }
      className={styles.eventTable}
      size="small"
    >
      <Table<IRealtimeEvent>
        columns={columns}
        dataSource={realtimeEvents.list}
        rowKey={(record, index) => `${record.deviceId}-${index}`}
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content', y: 400 }}
      />
    </Card>
  )
}

export default memo(EventTable)
