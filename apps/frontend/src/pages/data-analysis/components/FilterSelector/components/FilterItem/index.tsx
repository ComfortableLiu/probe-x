import React, { memo, useEffect, useMemo } from "react"
import * as styles from "./styles.module.scss"
import { DatePicker, Input, InputNumber, Select } from "antd"
import { useModel } from "@/hooks"
import { IPointState } from "@/store/models/point/type"
import {
  CompareType,
  IAttributionAnalysisFilter,
  MetaPropertyBusinessType,
  MetaPropertyType,
} from "@probe-x/shared-types/src"
import { checkNumber } from "@probe-x/shared-utils/src"
import dayjs from "dayjs"
import { CopyOne, Delete } from "@icon-park/react"

interface IFilterItemProps {
  filterItem?: IAttributionAnalysisFilter
  onChange?: (value: IAttributionAnalysisFilter) => void
  onCopy?: () => void
  onRemove?: () => void
}

// 各个类型的默认值
const filterInputDefaultValue = {
  [MetaPropertyType.DATE]: {
    EQUAL: dayjs().format('YYYY-MM-DD'),
    RANGE: [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
  },
  [MetaPropertyType.STRING]: {
    EQUAL: '',
    NOT_EQUAL: '',
    CONTAINS: [],
    NOT_CONTAINS: [],
    REGEX: '',
  },
  [MetaPropertyType.NUMBER]: {
    EQUAL: null,
    NOT_EQUAL: null,
    GREATER_THAN: null,
    GREATER_THAN_OR_EQUAL: null,
    LESS_THAN: null,
    LESS_THAN_OR_EQUAL: null,
    RANGE: [null, null],
    CONTAINS: [],
    NOT_CONTAINS: [],
  },
  [MetaPropertyType.BOOLEAN]: {
    EQUAL: 1,
  },
  [MetaPropertyType.FLOAT]: {
    EQUAL: null,
    NOT_EQUAL: null,
    GREATER_THAN: null,
    GREATER_THAN_OR_EQUAL: null,
    LESS_THAN: null,
    LESS_THAN_OR_EQUAL: null,
    RANGE: [null, null],
    CONTAINS: [],
    NOT_CONTAINS: [],
  },
}

// 各个类型支持的操作符
const filterInputSupportCompareType = {
  [MetaPropertyType.DATE]: {
    EQUAL: '等于',
    RANGE: '区间',
  },
  [MetaPropertyType.STRING]: {
    EQUAL: '等于',
    NOT_EQUAL: '不等于',
    CONTAINS: '包含',
    NOT_CONTAINS: '不包含',
    REGEX: '匹配正则',
  },
  [MetaPropertyType.NUMBER]: {
    EQUAL: '等于',
    NOT_EQUAL: '不等于',
    GREATER_THAN: '大于',
    GREATER_THAN_OR_EQUAL: '大于等于',
    LESS_THAN: '小于',
    LESS_THAN_OR_EQUAL: '小于等于',
    RANGE: '区间',
    CONTAINS: '包含',
    NOT_CONTAINS: '不包含',
  },
  [MetaPropertyType.BOOLEAN]: {
    EQUAL: '等于',
  },
  [MetaPropertyType.FLOAT]: {
    EQUAL: '等于',
    NOT_EQUAL: '不等于',
    GREATER_THAN: '大于',
    GREATER_THAN_OR_EQUAL: '大于等于',
    LESS_THAN: '小于',
    LESS_THAN_OR_EQUAL: '小于等于',
    RANGE: '区间',
    CONTAINS: '包含',
    NOT_CONTAINS: '不包含',
  },
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

  useEffect(() => {
    // 在属性类型和比较方式改变时，先粗暴的情况数据，等后续提升体验的时候可以兼容上次的输入内容转化到现在的输入框中
    const defaultValue = filterInputDefaultValue[filterItem.propertyType][filterItem.compareType] || undefined
    onChange({
      ...filterItem,
      propertyValue: defaultValue,
    })
  }, [filterItem.compareType])

  useEffect(() => {
    onChange({
      ...filterItem,
      compareType: 'EQUAL',
    })
  }, [filterItem.propertyType])

  // 渲染文本输入框
  const renderFilterTextInput = useMemo(() => (
    <Input
      style={{ width: 100 }}
      value={filterItem.propertyValue as string}
      onChange={(e) => {
        onChange && onChange({
          ...filterItem,
          propertyValue: e.target.value,
        })
      }}
    />
  ), [filterItem, onChange])

  // 渲染多个文本输入框
  const renderFilterTextMultipleInput = useMemo(() => (
    <Select
      mode="tags"
      style={{ width: 150 }}
      value={filterItem.propertyValue || []}
      onChange={(value) => {
        onChange && onChange({
          ...filterItem,
          propertyValue: value,
        })
      }}
      options={[]}
    />
  ), [filterItem, onChange])

  // 渲染数字输入框
  const renderFilterNumberInput = useMemo(() => (
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
  ), [filterItem, onChange])

  // 渲染数字区间输入框
  const renderFilterNumberRangeInput = useMemo(() => (
    <div className={styles.filterRangeInput}>
      <InputNumber
        style={{ width: 80 }}
        value={filterItem.propertyValue?.[0] as number}
        onChange={(value) => {
          onChange && onChange({
            ...filterItem,
            propertyValue: [value, filterItem.propertyValue?.[1]],
          })
        }}
      />
      <span>&nbsp;到&nbsp;</span>
      <InputNumber
        style={{ width: 80 }}
        value={filterItem.propertyValue?.[1] as number}
        onChange={(value) => {
          onChange && onChange({
            ...filterItem,
            propertyValue: [filterItem.propertyValue?.[0], value],
          })
        }}
      />
      <span>之间</span>
    </div>
  ), [filterItem, onChange])

  // 渲染多个数字输入框
  const renderFilterNumberMultipleInput = useMemo(() => (
    <Select
      mode="tags"
      style={{ width: 150 }}
      value={filterItem.propertyValue as number[] || []}
      onChange={(value) => {
        onChange && onChange({
          ...filterItem,
          propertyValue: value.filter((item) => checkNumber(item)),
        })
      }}
      options={[]}
    />
  ), [filterItem, onChange])

  // 渲染日期输入框
  const renderFilterDateInput = useMemo(() => (
    <DatePicker
      style={{ width: 150 }}
      value={dayjs(filterItem.propertyValue as string).isValid() ? dayjs(filterItem.propertyValue as string) : dayjs()}
      onChange={(value) => {
        onChange && onChange({
          ...filterItem,
          propertyValue: value?.format('YYYY-MM-DD'),
        })
      }}
    />
  ), [filterItem, onChange])

  // 渲染日期区间输入框
  const renderFilterDateRangeInput = useMemo(() => (
    <DatePicker.RangePicker
      style={{ width: 300 }}
      value={[dayjs(filterItem.propertyValue?.[0]).isValid() ? dayjs(filterItem.propertyValue?.[0]) : dayjs(), dayjs(filterItem.propertyValue?.[1]).isValid() ? dayjs(filterItem.propertyValue?.[1]) : dayjs()]}
      onChange={(value) => {
        onChange && onChange({
          ...filterItem,
          propertyValue: [value?.[0]?.format('YYYY-MM-DD'), value?.[1]?.format('YYYY-MM-DD')],
        })
      }}
    />
  ), [filterItem, onChange])

  // 渲染boolean选择框
  const renderFilterBooleanSelect = useMemo(() => (
    <Select
      style={{ width: 100 }}
      onChange={(value) => {
        onChange && onChange({
          ...filterItem,
          propertyValue: value,
        })
      }}
      value={Number(!!filterItem.propertyValue)}
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
  ), [filterItem, onChange])

  // 需要渲染的输入元素
  const renderFilterInputElement = useMemo(() => ({
    [MetaPropertyType.DATE]: {
      EQUAL: renderFilterDateInput,
      RANGE: renderFilterDateRangeInput,
    },
    [MetaPropertyType.STRING]: {
      EQUAL: renderFilterTextInput,
      NOT_EQUAL: renderFilterTextInput,
      CONTAINS: renderFilterTextMultipleInput,
      NOT_CONTAINS: renderFilterTextMultipleInput,
      REGEX: renderFilterTextInput,
    },
    [MetaPropertyType.NUMBER]: {
      EQUAL: renderFilterNumberInput,
      NOT_EQUAL: renderFilterNumberInput,
      GREATER_THAN: renderFilterNumberInput,
      GREATER_THAN_OR_EQUAL: renderFilterNumberInput,
      LESS_THAN: renderFilterNumberInput,
      LESS_THAN_OR_EQUAL: renderFilterNumberInput,
      RANGE: renderFilterNumberRangeInput,
      CONTAINS: renderFilterNumberMultipleInput,
      NOT_CONTAINS: renderFilterNumberMultipleInput,
    },
    [MetaPropertyType.BOOLEAN]: {
      EQUAL: renderFilterBooleanSelect,
    },
    [MetaPropertyType.FLOAT]: {
      EQUAL: renderFilterNumberInput,
      NOT_EQUAL: renderFilterNumberInput,
      GREATER_THAN: renderFilterNumberInput,
      GREATER_THAN_OR_EQUAL: renderFilterNumberInput,
      LESS_THAN: renderFilterNumberInput,
      LESS_THAN_OR_EQUAL: renderFilterNumberInput,
      RANGE: renderFilterNumberRangeInput,
      CONTAINS: renderFilterNumberMultipleInput,
      NOT_CONTAINS: renderFilterNumberMultipleInput,
    },
  }), [renderFilterBooleanSelect, renderFilterDateInput, renderFilterDateRangeInput, renderFilterNumberInput, renderFilterNumberMultipleInput, renderFilterNumberRangeInput, renderFilterTextInput, renderFilterTextMultipleInput])

  // 渲染筛选值输入框
  const renderFilterValueInput = useMemo(() => {
    return renderFilterInputElement[filterItem.propertyType][filterItem.compareType] || renderFilterTextInput
  }, [filterItem, renderFilterInputElement, renderFilterTextInput])

  // 属性名的options
  const propertyNameOptions = useMemo(() => {
    return [{
      label: <span>业务参数</span>,
      options: propertyList
        .filter(property => property.type === MetaPropertyBusinessType.BUSINESS)
        .map(property => ({
          label: property.propertyName,
          value: property.propertyName,
        })),
    }, {
      label: <span>公共参数</span>,
      options: propertyList
        .filter(property => property.type === MetaPropertyBusinessType.COMMON)
        .map(property => ({
          label: property.propertyName,
          value: property.propertyName,
        })),
    }]
  }, [propertyList])

  return (
    <div className={styles.container}>
      <Select
        style={{ width: 150 }}
        placeholder="属性名"
        onChange={(value) => {
          const property = propertyList.find(property => property.propertyName === value)
          const defaultValue = property.propertyType === MetaPropertyType.DATE ? dayjs().format('YYYY-MM-DD') :
            (property.propertyType === MetaPropertyType.STRING ? [] : 0)
          onChange && onChange({
            ...filterItem,
            propertyType: property.propertyType,
            propertyName: property.propertyName,
            propertyValue: defaultValue,
          })
        }}
        value={filterItem.propertyName ? filterItem.propertyName : null}
        options={propertyNameOptions}
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
        options={Object.keys(filterInputSupportCompareType[filterItem.propertyType || MetaPropertyType.STRING]).map(key => ({
          label: filterInputSupportCompareType[filterItem.propertyType || MetaPropertyType.STRING][key],
          value: key,
        }))}
      />
      {renderFilterValueInput}

      <div className={styles.operate}>
        <a href="#" className={styles.operateBtn} onClick={() => onCopy?.()}>
          <CopyOne className={styles.icon} theme="outline" size="14" fill="currentColor" />
          复制
        </a>
        <a href="#" className={styles.operateBtn} onClick={() => onRemove?.()}>
          <Delete className={styles.icon} theme="outline" size="14" fill="currentColor" />
          移除
        </a>
      </div>
    </div>
  )
}

export default memo(FilterItem)
