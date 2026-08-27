import React, { memo, useMemo, useState } from "react"
import * as echarts from "echarts"
import * as styles from "./styles.module.scss"
import { useLoading, useModel } from "@/hooks"
import { IDataAnalysisFunnelState } from "@pages/data-analysis/funnel/type"
import { Radio, theme } from "antd"
import ConversionRateItem from "@pages/data-analysis/funnel/components/DataChat/components/ConversionRateItem"
import ChartContainer from "@components/ChartContainer"
import type { EChartsOption } from "echarts"

function DataChat() {

  // 使用查询参数快照渲染，避免修改筛选配置后图表实时跟随变化（需点击「查询」才更新）
  const {
    data = [],
    querySnapshot,
  } = useModel<IDataAnalysisFunnelState>('dataAnalysisFunnelModel')

  const funnelInfoList = useMemo(() => querySnapshot?.funnelInfoList || [], [querySnapshot])

  const loading = useLoading()
  const { token } = theme.useToken()

  // 转化率展示类型
  const [showType, setShowType] = useState<'cumulative' | 'single'>('single')

  // 计算转化率：分母为 0 或结果非有限值时按 0 处理，避免出现 NaN%/Infinity%
  const calcConversionRate = (value?: number, base?: number): number | undefined => {
    if (value === undefined || base === undefined) return undefined
    if (!base) return 0
    const rate = value / base
    return Number.isFinite(rate) ? rate : 0
  }

  // 处理后的数据
  const chatData = useMemo(() => {
    if (!data.length) return []
    // TODO 先只取第一个维度数据
    // 步骤字段名与后端生成规则一致：优先 stepName，为空时回退 step_{n}_value
    const stepKey = (index: number) => funnelInfoList[index].stepName || `step_${index + 1}_value`
    return funnelInfoList.map((item, index) => {
      const isFirst = index === 0
      // 上一个值
      const prevItemValue = isFirst ? undefined : data[0][stepKey(index - 1)] as number
      const conversionRate = isFirst ? undefined : (
        showType === 'single'
          ? calcConversionRate(data[0][stepKey(index)] as number, prevItemValue)
          : calcConversionRate(data[0][stepKey(index)] as number, data[0][stepKey(0)] as number)
      )
      return {
        ...item,
        value: data[0][stepKey(index)] as number,
        conversionRate,
      }
    })
  }, [data, funnelInfoList, showType])

  const chartOption = useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const { name, value, dataIndex } = params as { name: string, value: number, dataIndex: number }
        const s = echarts.format.encodeHTML(name) + '<b/>' + echarts.format.encodeHTML(value) + '<b/>转化率: '
        return s + ((chatData[dataIndex]?.conversionRate ?? 1) * 100).toFixed(2) + '%'
      },
    },
    toolbox: {
      feature: {
        dataView: { readOnly: false },
        restore: {},
        saveAsImage: {},
      },
    },
    // 移除硬编码的 legend，漏斗图不需要图例，每个漏斗段都有自己的标签
    series: [
      {
        name: '转化率',
        type: 'funnel',
        left: '10%',
        top: 60,
        bottom: 60,
        width: '80%',
        min: 0,
        max: 100,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: {
          show: true,
          position: 'inside',
        },
        labelLine: {
          length: 10,
          lineStyle: {
            width: 1,
            type: 'solid',
          },
        },
        itemStyle: {
          borderColor: token.colorBgContainer,
          borderWidth: 1,
        },
        emphasis: {
          label: {
            fontSize: 20,
          },
        },
        data: chatData.map(info => ({
          value: info.value,
          name: info.stepName,
        })),
      },
    ],
  }), [chatData, token])

  return (
    <div className={styles.container}>
      {/* 切换单步转化率和累计转化率 */}
      <Radio.Group
        onChange={(value) => setShowType(value.target.value)}
        defaultValue="single"
        buttonStyle="solid"
      >
        <Radio.Button value="single">单步转化率</Radio.Button>
        <Radio.Button value="cumulative">累计转化率</Radio.Button>
      </Radio.Group>
      <div className={styles.chartContainer}>
        {/* 图表区 */}
        <div className={styles.chat}>
          <ChartContainer
            option={chartOption}
            height={500}
            loading={!!loading.dataAnalysisFunnelModel.submitQuery}
          />
        </div>
        {/* 数据详情区 */}
        <div className={styles.dataDetail}>
          <div className={styles.totalConversionRate}>
            总转化率：{chatData.length ? ((calcConversionRate(chatData[chatData.length - 1].value, chatData[0].value)! * 100).toFixed(2)) : '--'}%
          </div>
          {chatData.map((item, index) => {
            return (
              <ConversionRateItem
                key={item.stepName}
                value={item.value}
                conversionRate={item.conversionRate}
                index={index}
                funnelInfo={item}
                firstStepValue={chatData[0].value}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}


export default memo(DataChat)
