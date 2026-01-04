import React, { memo } from "react"
import { Radio } from "antd"
import { IFormRadioProps } from "./type"

function FormRadio(props: IFormRadioProps) {

  const {
    value,
    onChange,
    key,
    disabled,
    style,
    options = [],
    submit,
  } = props

  return (
    <Radio.Group
      id={key}
      key={key}
      style={{
        ...style,
      }}
      value={value}
      onChange={(e) => {
        onChange && onChange(e.target.value)
        submit && submit()
      }}
      disabled={disabled}
    >
      {options.map(option => (
        <Radio key={option.value} value={option.value}>
          {option.label}
        </Radio>
      ))}
    </Radio.Group>
  )
}

export default memo(FormRadio)

