/**
 * 测试辅助工具
 * 
 * 核心问题：@GrpcStreamMethod 装饰器在运行时会修改方法签名，
 * 导致 handleTaskStream 返回的不再是普通 Observable。
 * 
 * 解决方案：直接调用 ComputeNodeService 的内部方法
 * （getAllEvents + computeAttribution + ClickHouseService.insert），
 * 完全绕过 gRPC 装饰器层。
 */

import { ComputeNodeService } from '../../service/node.service'
import { computeAttribution } from '../../lib/attribution-engine'
import type { IPreEventLog } from '@probe-x/shared-types/src'

/**
 * 直接执行一次清洗任务（绕过 gRPC 装饰器）
 * 
 * 等价于控制中心推送一个 ComputeTask，但直接调用内部方法。
 */
export async function executeCleaningTask(
  service: ComputeNodeService,
  clickhouseService: any,
  taskId: string,
  sessionId: string,
  date: string = '2026-06-01',
): Promise<{
  eventList: IPreEventLog[]
  attributionCount: number
}> {
  // 1. 查询事件
  const eventList = await service.getAllEvents(date, sessionId)

  // 2. 执行归因计算
  const result = computeAttribution(eventList)

  // 3. 统一落库
  await Promise.all([
    clickhouseService.insert('final_event_log', result.finalEvents),
    clickhouseService.insert('event_attribution', result.attributions),
  ])

  return {
    eventList,
    attributionCount: result.attributions.length,
  }
}
