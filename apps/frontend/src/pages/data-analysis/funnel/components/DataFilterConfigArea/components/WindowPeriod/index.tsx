import React, { memo, useCallback, useMemo } from "react"
import { InputNumber, Select, Space } from "antd"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/funnel/type"

function WindowPeriod() {

  const {
    windowPeriod,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  // 窗口期最大值
  const windowPeriodMax = useMemo(() => {
    switch (windowPeriod?.unit) {
      case "d":
        return 3650
      case "h":
        return 3650 * 24
      case "m":
        return 3650 * 24 * 60
      default:
        return 1
    }
  }, [windowPeriod?.unit])

  // 根据单位转换值
  const windowPeriodValue = useCallback((oldUnit: 'd' | 'h' | 'm', newUnit: 'd' | 'h' | 'm', value: number) => {
    if (oldUnit === newUnit) {
      return value
    }
    if (oldUnit === 'd') {
      if (newUnit === 'h') {
        // 天 -> 小时
        return value * 24
      } else {
        // 天 -> 分钟
        return value * 24 * 60
      }
    } else if (oldUnit === 'h') {
      if (newUnit === 'd') {
        // 小时 -> 天
        return parseInt(`${value / 24}`)
      } else {
        // 小时 -> 分钟
        return value * 60
      }
    } else {
      if (newUnit === 'd') {
        // 分钟 -> 天
        return parseInt(`${value / 60 / 24}`)
      } else {
        // 分钟 -> 小时
        return parseInt(`${value / 60}`)
      }
    }
  }, [])

  if (!windowPeriod) {
    return null
  }

  return (
    <Space>
      <InputNumber
        min={1}
        max={windowPeriodMax}
        value={windowPeriod.value}
        onChange={(value)=>{
          refresh({
            windowPeriod: {
              value: value,
              unit: windowPeriod.unit,
            },
          }, true)
        }}
      />
      <Select
        value={windowPeriod.unit}
        styles={{
          root: {
            width: 80,
          },
        }}
        options={[{
          label: '天',
          value: 'd',
        }, {
          label: '小时',
          value: 'h',
        }, {
          label: '分钟',
          value: 'm',
        }]}
        onChange={value => {
          refresh({
            windowPeriod: {
              value: windowPeriodValue(windowPeriod.unit, value, windowPeriod.value),
              unit: value,
            },
          }, true)
        }}
      />
    </Space>
  )
}

export default memo(WindowPeriod)
