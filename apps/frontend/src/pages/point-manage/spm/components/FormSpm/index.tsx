import React, { memo } from "react"
import { IFormSpmProps, ISpmInfo } from "./type"
import { Input } from "antd"
import * as styles from "./styles.module.scss"

function FormSpm(props: IFormSpmProps) {

  const {
    value,
    onChange,
    disabled,
    placeholder,
  } = props

  const onChangeHandler = (key: keyof ISpmInfo, value: string) => {
    onChange && onChange({
      ...props.value,
      [key]: value,
    })
  }

  return (
    <div className={styles.container}>
      <Input
        value={value.a}
        onChange={(e) => onChangeHandler('a', e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        styles={{ input: { flex: 1 } }}
      />
      <span className={styles.dot}>.</span>
      <Input
        value={value.b}
        onChange={(e) => onChangeHandler('b', e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        styles={{ input: { flex: 1 } }}
      />
      <span className={styles.dot}>.</span>
      <Input
        value={value.c}
        onChange={(e) => onChangeHandler('c', e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        styles={{ input: { flex: 1 } }}
      />
      <span className={styles.dot}>.</span>
      <Input
        value={value.d}
        onChange={(e) => onChangeHandler('d', e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        styles={{ input: { flex: 1 } }}
      />
    </div>
  )
}

export default memo(FormSpm)
