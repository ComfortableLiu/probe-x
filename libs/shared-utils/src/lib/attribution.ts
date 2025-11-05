import type { IAnyObj, IAttribution, IEventScmInfo, IEventSpmInfo } from "@probe-x/shared-types/src"
import { underlineToCamel } from "./index"

/**
 * 将对象每一个属性转为归因数据
 */
export function convertObjectToAttribution(obj: IEventSpmInfo & IEventScmInfo & IAnyObj, eventTime: Date, sourcePageId: string, index: number): IAttribution[] {
  return Object.entries(obj).map(([key, value]) => ({
    source_page_id: sourcePageId,
    attribution_index: index,
    // 注意要将下划线格式转成小驼峰，方便使用的时候统一格式
    attr_key: underlineToCamel(key),
    attr_value: value,
    event_time: eventTime,
  }))
}