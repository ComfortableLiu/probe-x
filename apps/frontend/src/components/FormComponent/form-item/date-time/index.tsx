import React, { memo } from "react"
import { DatePicker } from "antd"
import dayjs, { Dayjs } from "dayjs"
import { IFormDateTimeProps } from "./type"

function FormDateTime(props: IFormDateTimeProps) {

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
    <DatePicker
      id={key}
      key={key}
      showTime
      style={{
        ...style,
        width: '100%',
      }}
      value={value ? dayjs(value) : undefined}
      onChange={(date: Dayjs | null) => {
        onChange && onChange(date ? date.format('YYYY-MM-DD HH:mm:ss') : undefined)
        submit && submit()
      }}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export default memo(FormDateTime)

