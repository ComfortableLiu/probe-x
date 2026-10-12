import type { IAnyObj, IAttribution } from "@probe-x/shared-types/src"
import { underlineToCamel } from "./index"

/**
 * 将对象每一个属性转为归因 KV 数据
 */
export function convertObjectToAttribution(obj: IAnyObj, eventTime: Date, eventId: string, sessionId: string): IAttribution[] {
  return Object.entries(obj).map(([key, value]) => ({
    event_id: eventId,
    session_id: sessionId,
    // 注意要将下划线格式转成小驼峰（保留 $ 前缀），方便使用的时候统一格式
    attr_key: underlineToCamel(key),
    attr_value: String(value),
    event_time: eventTime,
  }))
}
