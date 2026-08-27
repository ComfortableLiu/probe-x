import * as echarts from "echarts"
import type { EChartsOption } from "echarts"
import type { GlobalToken } from "antd"

/**
 * 基于 antd token 的有序分类色板
 * 用于图表 series 的默认着色，随主题自动变化
 */
export function getChartColors(token: GlobalToken): string[] {
  return [
    token.colorPrimary,
    token.colorSuccess,
    token.colorWarning,
    token.colorError,
    token.colorInfo,
    token.colorPurple,
    token.colorMagenta,
    token.colorCyan,
    token.colorPrimaryHover,
    token.colorSuccessHover,
    token.colorWarningHover,
    token.colorErrorHover,
  ]
}

/** 坐标轴线 / 轴标签颜色 */
export function getChartAxisColor(token: GlobalToken): string {
  return token.colorTextTertiary
}

/** 分割线颜色 */
export function getChartSplitLineColor(token: GlobalToken): string {
  return token.colorBorderSecondary
}

/** 弱填充颜色（axisPointer label、markArea 等） */
export function getChartFillColor(token: GlobalToken): string {
  return token.colorFillQuaternary
}

/** 将 hex 颜色转为 rgba，便于面积图渐变等场景 */
export function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith("#")) return hex
  let value = hex.slice(1)
  if (value.length === 3) {
    value = value.split("").map(char => char + char).join("")
  }
  const num = parseInt(value, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 生成与亮色主题一致的图表基础配置
 * ChartContainer 会将其与用户传入的 option 深合并（用户配置优先）
 */
export function getBaseChartOption(token: GlobalToken): EChartsOption {
  return {
    color: getChartColors(token),
    textStyle: {
      color: token.colorText,
      fontFamily: token.fontFamily,
    },
    legend: {
      textStyle: {
        color: token.colorTextSecondary,
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: 40,
      containLabel: true,
    },
    tooltip: {
      backgroundColor: token.colorBgElevated,
      borderColor: token.colorBorderSecondary,
      borderWidth: 1,
      textStyle: {
        color: token.colorText,
        fontSize: 12,
      },
      axisPointer: {
        lineStyle: {
          color: getChartAxisColor(token),
          width: 1,
          type: "solid",
        },
        label: {
          show: true,
          backgroundColor: getChartFillColor(token),
          color: token.colorText,
          fontSize: 11,
        },
      },
    },
    xAxis: {
      axisLine: {
        lineStyle: {
          color: token.colorBorderSecondary,
        },
      },
      axisTick: {
        lineStyle: {
          color: token.colorBorderSecondary,
        },
      },
      axisLabel: {
        color: getChartAxisColor(token),
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: getChartAxisColor(token),
      },
      splitLine: {
        lineStyle: {
          color: getChartSplitLineColor(token),
          type: "dashed",
        },
      },
    },
  }
}

/** 深合并图表配置，用户 option 优先于基础主题 */
export function mergeChartOption(base: EChartsOption, option: EChartsOption): EChartsOption {
  // 注意：echarts.util.merge 签名为 merge(target, source, overwrite)，不是变参合并。
  // 写成 merge({}, base, option, true) 会把 option 当成 overwrite 参数而丢弃用户配置，必须链式调用
  const result = echarts.util.merge(echarts.util.merge({}, base, true), option, true) as EChartsOption
  // 用户以数组形式传入坐标轴时（如双 y 轴），将基础轴样式合并进每一项
  const axisKeys = ["xAxis", "yAxis"] as const
  axisKeys.forEach(axisKey => {
    const baseAxis = base[axisKey]
    const userAxis = option[axisKey]
    if (baseAxis && Array.isArray(userAxis)) {
      result[axisKey] = userAxis.map(axis => echarts.util.merge(echarts.util.merge({}, baseAxis, true), axis, true))
    }
  })
  return result
}
