import React, { memo } from "react"
import { DatePicker } from "antd"
import dayjs, { Dayjs } from "dayjs"
import { IFormDateProps } from "./type"

function FormDate(props: IFormDateProps) {

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
      style={{
        ...style,
        width: '100%',
      }}
      value={value ? dayjs(value) : undefined}
      onChange={(date: Dayjs | null) => {
        onChange && onChange(date ? date.format('YYYY-MM-DD') : undefined)
        submit && submit()
      }}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export default memo(FormDate)

