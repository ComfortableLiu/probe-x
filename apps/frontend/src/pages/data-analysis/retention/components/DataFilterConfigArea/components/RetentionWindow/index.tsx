import React, { memo, useCallback, useMemo, useState } from "react"
import { Button, Checkbox, InputNumber, Tag } from "antd"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/retention/type"
import { RetentionGranularity } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

// 预设留存窗口（单位跟随时间粒度：天/周/月）
const PRESET_WINDOWS = [1, 2, 3, 7, 14, 30]

function RetentionWindow() {

  const {
    retentionWindows = [],
    granularity,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  // 自定义窗口输入值
  const [customValue, setCustomValue] = useState<number | null>(null)

  // 窗口单位文案跟随时间粒度
  const unitLabel = useMemo(() => {
    if (granularity === RetentionGranularity.WEEK) return '周'
    if (granularity === RetentionGranularity.MONTH) return '月'
    return '天'
  }, [granularity])

  // 已选中的自定义窗口（非预设项）
  const customWindows = useMemo(() => retentionWindows.filter(day => !PRESET_WINDOWS.includes(day)), [retentionWindows])

  // 写回 URL：去重并升序排列
  const updateWindows = useCallback((windows: number[]) => {
    refresh({
      retentionWindows: [...new Set(windows)].sort((a, b) => a - b),
    }, true)
  }, [refresh])

  // 切换预设窗口选中状态
  const togglePreset = useCallback((day: number, checked: boolean) => {
    updateWindows(checked
      ? [...retentionWindows, day]
      : retentionWindows.filter(item => item !== day))
  }, [retentionWindows, updateWindows])

  // 添加自定义窗口（正整数，1-90）
  const addCustom = useCallback(() => {
    if (!customValue) return
    updateWindows([...retentionWindows, customValue])
    setCustomValue(null)
  }, [customValue, retentionWindows, updateWindows])

  return (
    <div className={styles.container}>
      <div className={styles.presetList}>
        {PRESET_WINDOWS.map(day => (
          <Checkbox
            key={day}
            checked={retentionWindows.includes(day)}
            onChange={(e) => togglePreset(day, e.target.checked)}
          >
            {day}{unitLabel}
          </Checkbox>
        ))}
      </div>
      <div className={styles.customArea}>
        <InputNumber
          min={1}
          max={90}
          precision={0}
          placeholder={`自定义${unitLabel}数`}
          value={customValue}
          onChange={(value) => setCustomValue(value)}
        />
        <Button onClick={addCustom}>添加</Button>
        {customWindows.map(day => (
          <Tag
            key={day}
            closable
            onClose={() => updateWindows(retentionWindows.filter(item => item !== day))}
          >
            {day}{unitLabel}
          </Tag>
        ))}
      </div>
    </div>
  )
}

export default memo(RetentionWindow)
