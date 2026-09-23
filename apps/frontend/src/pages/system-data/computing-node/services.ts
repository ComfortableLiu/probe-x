import request from '@/lib/request'
import type { IComputeNodeTopology } from './type'

/** 计算节点拓扑（含链接状态），只读接口挂在 system-data 下 */
export function getComputingNodes() {
  return request<IComputeNodeTopology>({
    url: '/system-data/computing-nodes',
    method: 'get',
  })
}
