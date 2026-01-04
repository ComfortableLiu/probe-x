import React, { memo } from "react"
import { Rate } from "antd"
import { IFormRateProps } from "./type"

function FormRate(props: IFormRateProps) {

  const {
    value,
    onChange,
    key,
    disabled,
    style,
    submit,
    count = 5,
    allowHalf = false,
  } = props

  return (
    <Rate
      id={key}
      key={key}
      style={{
        ...style,
      }}
      value={value}
      onChange={(val) => {
        onChange && onChange(val)
        submit && submit()
      }}
      disabled={disabled}
      count={count}
      allowHalf={allowHalf}
    />
  )
}

export default memo(FormRate)

