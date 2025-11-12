import React, { memo } from "react"
import { Select } from "antd"
import * as styles from "./styles.module.scss"
import { AddOne } from "@icon-park/react"
import { useModel, useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/event/type"
import { IPointState } from "@/store/models/point/type"

function DimensionSelector() {

  const {
    dimension = [],
  } = useQuery<IQuery>()

  const {
    propertyList,
  } = useModel<IPointState>('pointModel')

  const {
    refresh,
  } = useRouter()

  /**
   * 修改事件维度
   * @param index 修改第index个
   * @param value 有值就是把第index个修改成value，为null就是删除第index个，如果超过了dimension.length，则添加一个
   */
  const changeDimension = (index: number, value: string | null) => {
    const list = [...dimension]
    if (index > list.length) {
      if (!value) return
      list.push(value)
    } else {
      if (value) {
        list[index] = value
      } else {
        list.splice(index, 1)
      }
    }
    refresh({
      dimension: list,
    }, true)
  }

  return (
    <div className={styles.container}>
      {dimension.map((item, index) => (
        <Select
          allowClear
          key={index}
          style={{ width: 120 }}
          onChange={(value) => {
            changeDimension(index, value)
          }}
          options={propertyList.map(property => ({
            label: property.propertyName,
            value: property.propertyName,
          }))}
          value={item}
        />
      ))}

      <a
        className={styles.addBtn}
        href="#"
        onClick={() => {
          changeDimension(dimension.length, '总体')
        }}
      >
        <AddOne theme="outline" size="16" fill="#3F51B5" style={{ display: 'flex' }} />
        增加维度
      </a>
    </div>
  )
}

export default memo(DimensionSelector)
