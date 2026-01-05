import React, { memo } from "react"
import { Slider } from "antd"
import { IFormSliderProps } from "./type"

function FormSlider(props: IFormSliderProps) {

  const {
    value,
    onChange,
    key,
    disabled,
    style,
    submit,
    min = 0,
    max = 100,
    step = 1,
    marks,
  } = props

  return (
    <Slider
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
      min={min}
      max={max}
      step={step}
      marks={marks}
    />
  )
}

export default memo(FormSlider)

