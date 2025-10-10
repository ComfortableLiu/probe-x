/**
 * 节点类型枚举
 */
export enum TrackingNodeType {
  SPM = 'spm',
  SCM = 'scm'
}

/**
 * 节点层级枚举 (1-4层)
 */
export enum TrackingNodeLevel {
  LEVEL1 = 1,
  LEVEL2 = 2,
  LEVEL3 = 3,
  LEVEL4 = 4
}

/**
 * 元事件状态枚举
 */
export enum TrackingNodeStatus {
  // 有效
  VALID = 1,
  // 停止接收
  STOP = 2,
  // 禁用
  DISABLE = 3,
  // 删除
  DELETE = 4,
}
