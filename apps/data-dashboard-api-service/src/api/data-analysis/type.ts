import { IAnyObj, MetaPropertyType } from "@probe-x/shared-types/src"

// 数据查询的下载任务key
export const DOWNLOAD_TASK_KEY = process.env.NODE_ENV + ':data-dashboard-api-service:analysis-download:'

// Bull 下载数据任务队列名称
export const QUEUE_NAME = 'query-download-queue'
// Bull 下载数据任务队列任务名称
export const QUEUE_TASK_NAME = 'query-download-task'

// 数据查询的下载任务存在Redis里面的数据结构
export interface IDownloadTask {
  taskId: string
  status: 'SUCCESS' | 'FAIL' | 'RUNNING'
  sql: string
  createTime: number
  sqlParams?: IAnyObj
  downloadUrl: string
}

/**
 * SQL生成结果类型（包含占位符参数映射）
 */
export interface ISqlGenerateResult {
  sql: string;
  params: Record<string, any>;
  error?: string;
}

/**
 * 元属性类型到ClickHouse数据类型的映射
 */
export const META_TYPE_TO_CH_TYPE: Record<MetaPropertyType, string> = {
  [MetaPropertyType.STRING]: 'String',
  [MetaPropertyType.NUMBER]: 'Int64',
  [MetaPropertyType.FLOAT]: 'Float64',
  [MetaPropertyType.BOOLEAN]: 'UInt8',
  [MetaPropertyType.DATE]: 'DateTime64',
}
