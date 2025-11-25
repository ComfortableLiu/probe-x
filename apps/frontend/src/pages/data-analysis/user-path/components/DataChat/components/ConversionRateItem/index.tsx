import React, { memo, useMemo } from "react"
import * as styles from "./styles.module.scss"
import { FunnelTypeEnum, IFunnelInfo } from "@probe-x/shared-types/src"
import { isEmpty } from "@probe-x/shared-utils/src"
import { useQuery } from "@/hooks"
import { IQuery } from "@pages/data-analysis/funnel/type"

interface IConversionRateItemProps {
  funnelInfo: IFunnelInfo
  // 值
  value: number
  // 转化率
  conversionRate?: number
  // 索引，0开始
  index: number
  // 第一步数值
  firstStepValue: number
}

function ConversionRateItem(props: IConversionRateItemProps) {

  const {
    funnelType,
  } = useQuery<IQuery>()

  const {
    funnelInfo,
    conversionRate,
    value,
    index,
    firstStepValue,
  } = props

  // 数据展示单位
  const dataUnit = useMemo(() => funnelType === FunnelTypeEnum.USER ? '人' : '次', [funnelType])

  // 展示转化率
  const renderConversionRate = useMemo(() => {
    if (isEmpty(conversionRate)) return null
    return (
      <div className={styles.conversionRate}>
        <div className={styles.background}>
          <div className={styles.top} />
          <div className={styles.bottom} />
        </div>
        {/* 保留两位小数，转成百分比 */}
        {(conversionRate * 100).toFixed(2)}%
      </div>
    )
  }, [conversionRate])

  return (
    <div className={styles.container}>
      {renderConversionRate}
      <div className={styles.dataDetail}>
        <div className={styles.title}>{funnelInfo.stepName}</div>
        <div className={styles.value}>{value}（{dataUnit}）</div>
      </div>
      <div className={styles.chat}>
        <div className={styles.tag}>
          {index + 1}
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar} style={{ width: `${(value * 100) / firstStepValue}%` }} />
        </div>
      </div>
    </div>
  )
}


export default memo(ConversionRateItem)
