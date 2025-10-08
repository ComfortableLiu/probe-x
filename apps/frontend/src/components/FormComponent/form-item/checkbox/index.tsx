import React, { memo } from "react"
import { Checkbox } from "antd"
import { IFormCheckboxProps } from "./type"

function FormCheckbox(props: IFormCheckboxProps) {

  const {
    value,
    onChange,
    key,
    disabled,
    style,
    submit,
  } = props

  return (
    <Checkbox
      id={key}
      key={key}
      style={{
        ...style,
      }}
      value={value}
      checked={value}
      onChange={(e) => {
        onChange && onChange(e.target.checked)
        submit && submit()
      }}
      disabled={disabled}
    />
  )
}

export default memo(FormCheckbox)
