import request from '@/lib/request'
import type { IComputeNodeTopology } from './type'
import type { IComputeNodeLogsQuery, IComputeNodeLogsRes } from '@probe-x/shared-types/src'

/** 计算节点拓扑（含链接状态），只读接口挂在 system-data 下 */
export function getComputingNodes() {
  return request<IComputeNodeTopology>({
    url: '/system-data/computing-nodes',
    method: 'get',
  })
}

/**
 * 计算节点运行日志
 *
 * 日志由节点经 gRPC 上行、总服务落 Redis；轮询场景用 noCatch 跳过全局错误 toast，
 * 失败时页面沿用上次数据并自行展示拉取异常。
 */
export function getComputingNodeLogs(nodeId: string, options: IComputeNodeLogsQuery = {}) {
  return request<IComputeNodeLogsRes>({
    url: `/system-data/computing-nodes/${encodeURIComponent(nodeId)}/logs`,
    method: 'get',
    data: options,
    noCatch: true,
  })
}
