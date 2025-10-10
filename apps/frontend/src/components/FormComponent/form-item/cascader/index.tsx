import React, { memo } from "react"
import { Cascader } from "antd"
import { IFormCascaderProps } from "./type"

function FormCascader(props: IFormCascaderProps) {

  const {
    value,
    onChange,
    key,
    placeholder,
    disabled,
    style,
    options = [],
    submit,
  } = props

  return (
    <Cascader
      id={key}
      key={key}
      style={{ ...style }}
      value={value}
      options={options}
      onChange={(e) => {
        onChange && onChange(e)
        submit && submit()
      }}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export default memo(FormCascader)