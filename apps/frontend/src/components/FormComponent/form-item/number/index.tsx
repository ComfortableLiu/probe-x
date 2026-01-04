import React, { memo } from "react"
import { InputNumber } from "antd"
import { IFormNumberProps } from "./type"

function FormNumber(props: IFormNumberProps) {

  const {
    value,
    onChange,
    key,
    placeholder,
    disabled,
    style,
    submit,
    min,
    max,
    step,
    precision,
  } = props

  return (
    <InputNumber
      id={key}
      key={key}
      style={{
        ...style,
        width: '100%',
      }}
      value={value}
      onChange={(val) => {
        onChange && onChange(val ?? undefined)
        submit && submit()
      }}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      precision={precision}
    />
  )
}

export default memo(FormNumber)

