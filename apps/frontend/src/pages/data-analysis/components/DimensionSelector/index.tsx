import React, { memo, useMemo } from "react"
import { Select } from "antd"
import * as styles from "./styles.module.scss"
import { Plus } from "@icon-park/react"
import { useModel, useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/event/type"
import { IPointState } from "@/store/models/point/type"

interface IDimensionSelectorProps {
  dimension?: string[]
  onChange?: (dimension: string[]) => void
  // 设置路由的key
  queryKey?: string
}

function DimensionSelector(props: IDimensionSelectorProps) {

  const query = useQuery<IQuery>()

  const {
    propertyList,
  } = useModel<IPointState>('pointModel')

  const {
    refresh,
  } = useRouter()

  const dimensionInfo = useMemo<string[]>(() => {
    return props.dimension || query[props?.queryKey] || query.dimension || []
  }, [props.dimension, props?.queryKey, query])

  /**
   * 修改事件维度
   * @param index 修改第index个
   * @param value 有值就是把第index个修改成value，为null就是删除第index个，如果超过了dimension.length，则添加一个
   */
  const changeDimension = (index: number, value?: string | undefined) => {
    const list = [...dimensionInfo]
    if (index > list.length) {
      if (value === undefined) return
      list.push(value)
    } else {
      if (value !== undefined) {
        list[index] = value
      } else {
        list.splice(index, 1)
      }
    }
    if (props?.onChange) {
      props.onChange(list)
    } else {
      refresh({
        [props?.queryKey || 'dimension']: list,
      }, true)
    }
  }

  return (
    <div className={styles.container}>
      {dimensionInfo.map((item, index) => (
        <Select
          allowClear
          key={index}
          style={{ width: 120 }}
          onChange={(value) => changeDimension(index, value)}
          options={[{ label: '总体', value: '' }, ...propertyList.map(property => ({
            label: property.propertyName,
            value: property.propertyName,
          }))]}
          value={item}
        />
      ))}

      <a
        className={styles.addBtn}
        href="#"
        onClick={() => changeDimension(dimensionInfo.length, '')}
      >
        <Plus theme="outline" size="16" fill="#3F51B5" style={{ display: 'flex' }} />
        增加维度
      </a>
    </div>
  )
}

export default memo(DimensionSelector)
