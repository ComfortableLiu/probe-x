import React, { memo, useCallback } from "react"
import * as styles from "./styles.module.scss"
import { Plus } from "@icon-park/react"
import { useQuery, useRouter } from "@/hooks"
import { IAttributionFilter, IQuery } from "@pages/data-analysis/event/type"
import FilterSelector from "../FilterSelector"
import { MetaPropertyType } from "@probe-x/shared-types/src"

function GlobalFilter() {

  const {
    globalFilters = [],
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const handleChange = useCallback((value: IAttributionFilter[]) => {
    console.log('value', value)
    refresh({
      globalFilters: value,
    }, true)
  }, [refresh])

  // 增加一个新筛选项
  const handleAdd = useCallback(() => {
    handleChange([
      ...globalFilters,
      {
        propertyName: '',
        propertyType: MetaPropertyType.STRING,
        propertyValue: [],
        compareType: 'EQUAL',
      } as IAttributionFilter,
    ])
  }, [globalFilters, handleChange])

  return (
    <div className={styles.container}>
      <FilterSelector
        value={globalFilters}
        onChange={value => handleChange(value)}
      />
      <a
        className={styles.addBtn}
        onClick={() => handleAdd()}
        href="#"
      >
        <Plus theme="outline" size="16" fill="#3F51B5" style={{ display: 'flex' }} />
        全局筛选
      </a>
    </div>
  )
}

export default memo(GlobalFilter)
