export interface IEventSpmInfo {
  $spm: string
  $spm_a: string
  $spm_b: string
  $spm_c: string
  $spm_d: string
  $spm_a_description: string
  $spm_b_description: string
  $spm_c_description: string
  $spm_d_description: string
}

export interface IEventScmInfo {
  $scm: string
  $scm_a: string
  $scm_b: string
  $scm_c: string
  $scm_d: string
  $scm_a_description: string
  $scm_b_description: string
  $scm_c_description: string
  $scm_d_description: string
}

// 每一个归因参数
export interface IAttributionItem extends IEventSpmInfo, IEventScmInfo {
  serviceTime: Date
}

/**
 * 绑定页面的全归因参数
 */
export type IAttributionInfo = IAttributionItem[]
