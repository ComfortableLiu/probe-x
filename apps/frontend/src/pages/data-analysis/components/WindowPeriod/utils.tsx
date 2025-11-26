// 根据单位转换值
export const windowPeriodValue = (oldUnit: 'd' | 'h' | 'm', newUnit: 'd' | 'h' | 'm', value: number) => {
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
}
