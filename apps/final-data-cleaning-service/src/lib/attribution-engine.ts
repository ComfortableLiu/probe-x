/**
 * 归因引擎 — 从 node.service.ts 中提取的核心归因算法
 *
 * 设计为纯函数，方便独立测试。
 * 输入：按时间排序的事件列表
 * 输出：{ finalEvents, attributions }
 */

import { IAttribution, IPreEventLog } from '@probe-x/shared-types/src'
import { convertObjectToAttribution } from '@probe-x/shared-utils/src'

/** 归因只依赖事件自身的这些字段，可以独立分块计算。 */
export type AttributionEvent = Pick<IPreEventLog,
  '$is_attribution_event' | '$target_page_id' | '$ex_attribution_params'
  | '$service_time' | '$event_id' | '$session_id'>

export interface AttributionEngineResult<T extends AttributionEvent = IPreEventLog> {
  /** 最终事件列表（透传，结构不变） */
  finalEvents: T[]
  /** 归因 KV 数据 */
  attributions: IAttribution[]
}

/**
 * 解析 $ex_attribution_params。
 * 该字段在 ClickHouse 中是 String（JSON），读出后是 JSON 字符串，需先 JSON.parse；
 * 上游若已传入对象则直接使用。非法 JSON / 非对象结果一律按无扩展参数处理。
 */
function parseExAttributionParams(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object') {
    return Array.isArray(raw) ? {} : raw as Record<string, unknown>
  }
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

/**
 * 执行归因计算
 *
 * 核心逻辑：
 * - 遍历事件序列（按时间顺序），逐条推送进度
 * - 归因事件（$is_attribution_event && $target_page_id，即携带 SPM/SCM 的落地 page_view）
 *   将其 $ex_attribution_params 解析后展开为 KV 行，
 *   event_id / session_id / event_time 均取自事件本身
 * - 不做跨页面链式累积：归因链由查询侧按 session 内时间前缀动态拼装；
 *   SPM/SCM 标准字段已是 final_event_log 的列，不写入 KV 子表；
 *   无扩展参数的事件不产生 KV 行
 *
 * @param eventList 按时间排序的事件列表
 * @param onProgress 可选的进度回调，每处理完一个事件调用一次
 */
export function computeAttribution<T extends AttributionEvent>(
  eventList: T[],
  onProgress?: (processed: number, total: number) => void,
): AttributionEngineResult<T> {
  const attributionList: IAttribution[] = []

  eventList.forEach((item, index) => {
    // 逐条推送进度
    onProgress?.(index + 1, eventList.length)
    // 只处理归因事件：把扩展归因参数展开为 KV 行
    if (item.$is_attribution_event && item.$target_page_id) {
      const exParams = parseExAttributionParams(item.$ex_attribution_params)
      // 逐行追加，避免扩展参数过多时数组展开超过函数实参数量上限。
      for (const attribution of convertObjectToAttribution(exParams, item.$service_time as Date, item.$event_id, item.$session_id)) {
        attributionList.push(attribution)
      }
    }
  })

  return {
    finalEvents: eventList,
    attributions: attributionList,
  }
}
