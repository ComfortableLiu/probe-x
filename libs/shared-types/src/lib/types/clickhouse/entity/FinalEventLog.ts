import { IPreEventLog } from "./PreEventLog"

// 最终清洗后的事件
// PS 目前最后一步清洗的归因数据已经已到单独的表中了，不需要额外增加字段了
export interface IFinalEventLog extends IPreEventLog {
}
