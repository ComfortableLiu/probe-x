import React, { memo } from "react"
import { TimePicker } from "antd"
import dayjs, { Dayjs } from "dayjs"
import { IFormTimeProps } from "./type"

function FormTime(props: IFormTimeProps) {

  const {
    value,
    onChange,
    key,
    placeholder,
    disabled,
    style,
    submit,
  } = props

  return (
    <TimePicker
      id={key}
      key={key}
      style={{
        ...style,
        width: '100%',
      }}
      value={value ? dayjs(value, 'HH:mm:ss') : undefined}
      onChange={(time: Dayjs | null) => {
        onChange && onChange(time ? time.format('HH:mm:ss') : undefined)
        submit && submit()
      }}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export default memo(FormTime)

