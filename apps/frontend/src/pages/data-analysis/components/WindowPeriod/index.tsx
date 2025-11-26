import React, { memo, useMemo } from "react"
import { InputNumber, Select, Space } from "antd"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/funnel/type"
import { windowPeriodValue } from "@pages/data-analysis/components/WindowPeriod/utils"

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
