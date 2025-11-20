import React, { CSSProperties, memo, useMemo } from "react"
import * as style from "./styles.module.scss"
import { IAttributionAnalysisFilter } from "../../../../../../../libs/shared-types/src"
import FilterItem from "./components/FilterItem"

interface IFilterSelectorProps {
  value?: IAttributionAnalysisFilter[]
  onChange?: (value: IAttributionAnalysisFilter[]) => void
  styles?: CSSProperties
}

function FilterSelector(props: IFilterSelectorProps) {

  const {
    value = [],
    onChange,
    styles,
  } = props

  // 渲染左侧标识
  const renderTag = useMemo(() => {
    if (value.length < 2) return null
    return (
      <div className={style.left}>
        <div className={style.line} />
        <div className={style.tag}>且</div>
        <div className={style.line} />
      </div>
    )
  }, [value])

  // 渲染筛选项
  const renderFilterItem = useMemo(() => {
    return value.map((item, index) => {
      return (
        <FilterItem
          key={index}
          filterItem={item}
          onChange={(filter) => {
            const list = [...value]
            list[index] = filter
            onChange && onChange(list)
          }}
          onRemove={() => {
            const list = [...value]
            list.splice(index, 1)
            onChange && onChange(list)
          }}
          onCopy={() => {
            const list = [...value]
            list.splice(index, 0, { ...item })
            onChange && onChange(list)
          }}
        />
      )
    })
  }, [onChange, value])

  if (!value) {
    return null
  }

  return (
    <div className={style.container} style={styles}>
      {renderTag}
      {/* 筛选主区域 */}
      <div className={style.main}>
        {renderFilterItem}
      </div>
    </div>
  )
}

export default memo(FilterSelector)
