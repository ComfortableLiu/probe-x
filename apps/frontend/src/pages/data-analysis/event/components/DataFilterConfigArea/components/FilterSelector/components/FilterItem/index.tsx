import React, { memo, useMemo } from "react"
import * as styles from "./styles.module.scss"
import { CompareText, CompareType, IAttributionFilter } from "@pages/data-analysis/event/type"
import { DatePicker, InputNumber, Select } from "antd"
import { useModel } from "@/hooks"
import { IPointState } from "@/store/models/point/type"
import { MetaPropertyType } from "@probe-x/shared-types/src"
import dayjs from "dayjs"
import { CopyOne, Delete } from "@icon-park/react"

interface IFilterItemProps {
  filterItem?: IAttributionFilter
  onChange?: (value: IAttributionFilter) => void
  onCopy?: () => void
  onRemove?: () => void
}

function FilterItem(props: IFilterItemProps) {

  const {
    filterItem,
    onChange,
    onCopy,
    onRemove,
  } = props

  const {
    propertyList,
  } = useModel<IPointState>('pointModel')

  // 渲染筛选值输入框
  const renderFilterValueInput = useMemo(() => {
    switch (filterItem.propertyType) {
      case MetaPropertyType.BOOLEAN:
        return (
          <Select
            style={{ width: 150 }}
            placeholder="请选择"
            onChange={(value) => {
              onChange && onChange({
                ...filterItem,
                propertyValue: value,
              })
            }}
            value={filterItem.propertyValue}
            options={[
              {
                label: '真',
                value: 1,
              },
              {
                label: '假',
                value: 0,
              },
            ]}
          />
        )
      case MetaPropertyType.DATE:
        return (
          <DatePicker
            style={{ width: 150 }}
            value={dayjs(filterItem.propertyValue as string)}
            onChange={(value) => {
              onChange && onChange({
                ...filterItem,
                propertyValue: value?.format('YYYY-MM-DD'),
              })
            }}
          />
        )
      case MetaPropertyType.FLOAT:
      case MetaPropertyType.NUMBER:
        return (
          <InputNumber
            style={{ width: 100 }}
            value={filterItem.propertyValue as number}
            onChange={(value) => {
              onChange && onChange({
                ...filterItem,
                propertyValue: value,
              })
            }}
          />
        )
      case MetaPropertyType.STRING:
        return (
          <Select
            mode="tags"
            style={{ width: 150 }}
            placeholder="Tags Mode"
            value={filterItem.propertyValue as string[]}
            onChange={(value) => {
              onChange && onChange({
                ...filterItem,
                propertyValue: value,
              })
            }}
            options={[]}
          />
        )
    }
  }, [filterItem, onChange])

  return (
    <div className={styles.container}>
      <Select
        style={{ width: 150 }}
        placeholder="属性名"
        onChange={(value) => {
          onChange && onChange({
            ...filterItem,
            propertyName: value,
          })
        }}
        value={filterItem.propertyName ? filterItem.propertyName : null}
        options={propertyList.map(property => ({
          label: property.propertyName,
          value: property.propertyName,
        }))}
      />
      <Select
        className={styles.selectCompare}
        placeholder="关系符"
        onChange={(value: CompareType) => {
          onChange && onChange({
            ...filterItem,
            compareType: value,
          })
        }}
        value={filterItem.compareType}
        options={Object.keys(CompareText).map(key => ({
          label: CompareText[key],
          value: key,
        }))}
      />
      {renderFilterValueInput}

      <div className={styles.operate}>
        <a href="#" className={styles.operateBtn} onClick={() => onCopy?.()}>
          <CopyOne className={styles.icon} theme="outline" size="14" fill="#333" />
          复制
        </a>
        <a href="#" className={styles.operateBtn} onClick={() => onRemove?.()}>
          <Delete className={styles.icon} theme="outline" size="14" fill="#333" />
          移除
        </a>
      </div>
    </div>
  )
}

export default memo(FilterItem)
