import React, { memo } from "react"
import { Select } from "antd"
import { IFormSelectProps } from "./type"

function FormSelect(props: IFormSelectProps) {

  const {
    value,
    onChange,
    key,
    placeholder,
    disabled,
    style,
    options = [],
    submit,
    multiple = false,
    allowClear = true,
  } = props

  return (
    <Select
      id={key}
      key={key}
      style={{
        ...style,
        width: '100%',
      }}
      value={value}
      options={options}
      onChange={(val) => {
        onChange && onChange(val)
        submit && submit()
      }}
      placeholder={placeholder}
      disabled={disabled}
      mode={multiple ? 'multiple' : undefined}
      allowClear={allowClear}
    />
  )
}

export default memo(FormSelect)

