import React, { memo } from 'react'
import { Descriptions, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import type { IServiceResourceGroup } from '@probe-x/shared-types/src'

interface ResourceRow {
  key: string
  name: string
  serviceKey: string
  sample?: IServiceResourceGroup['instances'][number]
}

const percent = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(1)}%`
const memory = (value: number | null | undefined) => {
  if (value == null) return '—'
  return value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GB` : `${(value / 1024 ** 2).toFixed(1)} MB`
}
const timestamp = (value: number) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
const duration = (value: number) => `${Math.floor(value / 86400)} 天 ${Math.floor(value % 86400 / 3600)} 小时 ${Math.floor(value % 3600 / 60)} 分钟`

function ServiceResources({ serviceResources }: { serviceResources: IServiceResourceGroup[] }) {
  const rows: ResourceRow[] = (serviceResources || []).flatMap(group => group.instances.length
    ? group.instances.map(sample => ({ key: sample.instanceId, name: group.serviceName, serviceKey: group.serviceKey, sample }))
    : [{ key: group.serviceKey, name: group.serviceName, serviceKey: group.serviceKey }])
  const columns: TableColumnsType<ResourceRow> = [{
    title: '服务 / 实例',
    key: 'service',
    width: 190,
    fixed: 'left',
    render: (_, row) => (
      <div>
        <Typography.Text strong>{row.name}</Typography.Text>
        <br />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {row.sample ? `${row.sample.hostname} · PID ${row.sample.pid}` : '尚未收到资源采样'}
        </Typography.Text>
      </div>
    ),
  }, {
    title: '采样状态', key: 'status', width: 95,
    render: (_, { sample }) => !sample ? <Tag>未接入</Tag>
      : sample.status === 'online' ? <Tag color="success">在线</Tag> : <Tag color="default">已停止上报</Tag>,
  }, {
    title: <Tooltip title="100% 表示占满一个逻辑核心，多线程或多个工作进程可超过 100%。">进程 CPU</Tooltip>,
    key: 'cpu', width: 100,
    render: (_, { sample }) => percent(sample?.status === 'online' ? sample.cpuUsage : null),
  }, {
    title: <Tooltip title="常驻物理内存 RSS；外部采集器为主进程及其子进程之和，可能重复统计共享页面。">进程内存</Tooltip>,
    key: 'memory', width: 110,
    render: (_, { sample }) => memory(sample?.status === 'online' ? sample.memoryRssBytes : null),
  }, {
    title: '主机 CPU', key: 'hostCpu', width: 95,
    render: (_, { sample }) => percent(sample?.status === 'online' ? sample.hostCpuUsage : null),
  }, {
    title: '最后采样', key: 'sampledAt', width: 130,
    render: (_, { sample }) => sample ? <Tooltip title={timestamp(sample.sampledAt)}>{new Date(sample.sampledAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</Tooltip> : '—',
  }]

  return (
    <div>
      <Typography.Paragraph type="secondary">
        每 10 秒采集，超过 45 秒无心跳视为停止上报。同一主机上被重启取代的已停止实例不再逐条显示：有在线实例时仅展示在线实例，全部停止时只保留最近一条。同一主机上的服务共享主机资源，请勿相加；展开实例可查看主机内存、负载、堆内存及运行时长。
      </Typography.Paragraph>
      <Table<ResourceRow>
        rowKey="key"
        columns={columns}
        dataSource={rows}
        size="small"
        pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
        scroll={{ x: 760 }}
        locale={{ emptyText: '服务资源数据暂不可用' }}
        expandable={{
          rowExpandable: row => !!row.sample,
          expandedRowRender: ({ sample }) => (
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="服务标识">{sample.serviceKey}</Descriptions.Item>
              <Descriptions.Item label="采集范围">{sample.scope === 'process-tree' ? `主进程及 ${sample.processCount - 1} 个子进程` : '服务进程（包含原生线程）'}</Descriptions.Item>
              <Descriptions.Item label="主机内存">{sample.status === 'online' ? `${memory(sample.hostMemoryUsedBytes)} / ${memory(sample.hostMemoryTotalBytes)}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="逻辑核心数">{sample.cpuCores}</Descriptions.Item>
              <Descriptions.Item label="运行时长（采样时）">{duration(sample.uptimeSeconds)}</Descriptions.Item>
              <Descriptions.Item label="主机 1 分钟负载">{sample.status === 'online' ? sample.hostLoad1?.toFixed(2) ?? '—' : '—'}</Descriptions.Item>
              <Descriptions.Item label="Node.js 堆内存">{memory(sample.status === 'online' ? sample.heapUsedBytes : null)}</Descriptions.Item>
              {sample.stoppedAt && <Descriptions.Item label="停止时间">{timestamp(sample.stoppedAt)}</Descriptions.Item>}
            </Descriptions>
          ),
        }}
      />
    </div>
  )
}

export default memo(ServiceResources)
