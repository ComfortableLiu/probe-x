import React, { memo } from "react"
import { Switch } from "antd"
import { IFormSwitchProps } from "./type"

function FormSwitch(props: IFormSwitchProps) {

  const {
    value,
    onChange,
    key,
    disabled,
    style,
    submit,
  } = props

  return (
    <Switch
      id={key}
      key={key}
      style={{
        ...style,
      }}
      checked={value}
      onChange={(checked) => {
        onChange && onChange(checked)
        submit && submit()
      }}
      disabled={disabled}
    />
  )
}

export default memo(FormSwitch)

