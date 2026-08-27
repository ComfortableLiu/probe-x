/**
 * 归因引擎 — 从 node.service.ts 中提取的核心归因算法
 * 
 * 设计为纯函数，方便独立测试。
 * 输入：按时间排序的事件列表
 * 输出：{ finalEvents, attributions }
 */

import { IAttribution, IAttributionInfo, IPreEventLog } from '@probe-x/shared-types/src'
import { convertObjectToAttribution } from '@probe-x/shared-utils/src'

export interface AttributionEngineResult {
  /** 最终事件列表（透传，结构不变） */
  finalEvents: IPreEventLog[]
  /** 归因 KV 数据 */
  attributions: IAttribution[]
  /** 归因数据 Map（页面 → 归因项列表），便于调试 */
  attributionDataMap: Map<string, IAttributionInfo>
}

/**
 * 执行归因计算
 * 
 * 核心算法：
 * - 遍历事件序列（按时间顺序）
 * - 当事件是归因事件（$is_attribution_event && $target_page_id）时：
 *   - 从 Map 中取出源页面（$page_id）的累计归因数据
 *   - 构建当前页面的归因数据（SPM + SCM + 扩展参数）
 *   - 将新归因项追加到源页面的归因数组中
 *   - 以 $target_page_id 为 key 存入 Map
 * - 遍历完成后，将所有归因数据展开为 KV 格式
 * 
 * @param eventList 按时间排序的事件列表
 * @param onProgress 可选的进度回调，每处理完一个事件调用一次
 */
export function computeAttribution(
  eventList: IPreEventLog[],
  onProgress?: (processed: number, total: number) => void,
): AttributionEngineResult {
  // 页面级别的累积归因状态
  const attributionDataMap = new Map<string, IAttributionInfo>()

  // 从第一个事件向后扫描
  eventList.forEach((item, index) => {
    // 逐条推送进度
    onProgress?.(index + 1, eventList.length)
    // 检查是否是更新归因逻辑的事件
    if (item.$is_attribution_event && item.$target_page_id) {
      // 从上个页面取出来累计归因数据
      const sourceAttributionData = [...(attributionDataMap.get(item.$page_id) || [])]

      // 计算当前页面的归因数据
      const currentPageAttributionData = {
        $spm: item.$spm,
        $spm_a: item.$spm_a,
        $spm_b: item.$spm_b,
        $spm_c: item.$spm_c,
        $spm_d: item.$spm_d,
        $spm_a_description: item.$spm_a_description,
        $spm_b_description: item.$spm_b_description,
        $spm_c_description: item.$spm_c_description,
        $spm_d_description: item.$spm_d_description,
        $scm: item.$scm,
        $scm_a: item.$scm_a,
        $scm_b: item.$scm_b,
        $scm_c: item.$scm_c,
        $scm_d: item.$scm_d,
        $scm_a_description: item.$scm_a_description,
        $scm_b_description: item.$scm_b_description,
        $scm_c_description: item.$scm_c_description,
        $scm_d_description: item.$scm_d_description,
        // 其他自定义归因字段
        ...(item.$ex_attribution_params || {}),
      }

      sourceAttributionData.push({
        serviceTime: item.$service_time,
        ...currentPageAttributionData,
      })

      // 以目标页面 ID 为 key 存入 Map
      attributionDataMap.set(item.$target_page_id, sourceAttributionData)
    }
  })

  // 展开为 KV 归因列表
  const attributionList: IAttribution[] = []
  attributionDataMap.forEach((value, key) => {
    value.forEach((item, index) => {
      attributionList.push(...convertObjectToAttribution(item, item.serviceTime, key, index))
    })
  })

  return {
    finalEvents: eventList,
    attributions: attributionList,
    attributionDataMap,
  }
}
