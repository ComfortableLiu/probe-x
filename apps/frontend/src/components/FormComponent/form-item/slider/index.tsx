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
      }}
      // 拖动结束后再触发提交，避免拖动过程中频繁提交
      onChangeComplete={() => {
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

