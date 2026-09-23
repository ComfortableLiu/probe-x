import React, { memo, useCallback, useMemo } from "react"
import { Select } from "antd"
import { Plus } from "@icon-park/react"
import { useModel, useQuery, useRouter } from "@/hooks"
import {
  IUtmOptionItem,
  IUtmValueFilter,
  UtmDimension,
  UTM_DIMENSIONS,
  UTM_DIMENSION_OPTION_LABEL,
} from "@probe-x/shared-types/src"
import { IDataAnalysisUtmState, IQuery } from "@pages/data-analysis/utm/type"
import { formatUtmValue, buildUtmAliasMap } from "@pages/data-analysis/utm/utils"
import * as styles from "./styles.module.scss"

/**
 * UTM 取值筛选
 *
 * 取值选项来自 UTM 管理维护的条目，下拉里带别名展示；
 * 已软删的取值压根不出现在选项里，分析侧也会整体排除它们
 */
function UtmValueFilter() {

  const {
    utmFilters = [],
  } = useQuery<IQuery>()

  const {
    utmOptions = [],
  } = useModel<IDataAnalysisUtmState>('dataAnalysisUtmModel')

  const {
    refresh,
  } = useRouter()

  const aliasMap = useMemo(() => buildUtmAliasMap(utmOptions), [utmOptions])

  // 按维度分组的取值选项
  const optionsByDimension = useMemo(() => {
    const map: Partial<Record<UtmDimension, IUtmOptionItem[]>> = {}
    utmOptions.forEach(item => {
      if (!map[item.dimension]) {
        map[item.dimension] = []
      }
      map[item.dimension].push(item)
    })
    return map
  }, [utmOptions])

  const handleChange = useCallback((value: IUtmValueFilter[]) => {
    refresh({
      utmFilters: value,
    }, true)
  }, [refresh])

  const changeFilter = useCallback((index: number, value: IUtmValueFilter) => {
    const list = [...utmFilters]
    list[index] = value
    handleChange(list)
  }, [utmFilters, handleChange])

  const addFilter = useCallback(() => {
    handleChange([
      ...utmFilters,
      {
        dimension: UTM_DIMENSIONS[0],
        values: [],
      } as IUtmValueFilter,
    ])
  }, [utmFilters, handleChange])

  const removeFilter = useCallback((index: number) => {
    handleChange(utmFilters.filter((_, i) => i !== index))
  }, [utmFilters, handleChange])

  return (
    <div className={styles.container}>
      {utmFilters.map((filter, index) => (
        <div className={styles.row} key={index}>
          <Select<UtmDimension>
            style={{ width: 220 }}
            placeholder="维度"
            value={filter.dimension}
            // 换维度后取值失效，直接清空，避免旧维度的取值被拼进新维度的条件
            onChange={(value) => changeFilter(index, { dimension: value, values: [] })}
            options={UTM_DIMENSIONS.map((dimension) => ({
              label: UTM_DIMENSION_OPTION_LABEL[dimension],
              value: dimension,
            }))}
          />
          <Select
            mode="multiple"
            allowClear
            style={{ minWidth: 360 }}
            placeholder="选择取值，可多选"
            value={filter.values}
            onChange={(value) => changeFilter(index, { ...filter, values: value })}
            optionFilterProp="label"
            options={(optionsByDimension[filter.dimension] || []).map((item) => ({
              label: formatUtmValue(item.dimension, item.value, aliasMap),
              value: item.value,
            }))}
          />
          <a href="#" onClick={(e) => {
            e.preventDefault()
            removeFilter(index)
          }}>
            删除
          </a>
        </div>
      ))}

      <a
        className={styles.addBtn}
        href="#"
        onClick={(e) => {
          e.preventDefault()
          addFilter()
        }}
      >
        <Plus theme="outline" size="14" fill="currentColor" />
        添加 UTM 取值筛选
      </a>
    </div>
  )
}

export default memo(UtmValueFilter)
