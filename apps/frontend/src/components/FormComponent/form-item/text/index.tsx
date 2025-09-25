import React, { memo } from "react"
import { Input } from "antd"
import { IFormTextProps } from "./type"

function FormText(props: IFormTextProps) {

  const {
    value,
    onChange,
    key,
    placeholder,
    disabled,
    style,
  } = props

  return (
    <Input
      id={key}
      key={key}
      style={{
        ...style,
      }}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export default memo(FormText)