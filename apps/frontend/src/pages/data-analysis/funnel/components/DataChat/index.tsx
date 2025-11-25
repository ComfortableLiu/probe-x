import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as echarts from "echarts"
import * as styles from "./styles.module.scss"
import { useLoading, useModel, useQuery } from "@/hooks"
import { IDataAnalysisFunnelState, IQuery } from "@pages/data-analysis/funnel/type"
import { Radio } from "antd"
import ConversionRateItem from "@pages/data-analysis/funnel/components/DataChat/components/ConversionRateItem"

function DataChat() {

  const {
    data = [],
  } = useModel<IDataAnalysisFunnelState>('dataAnalysisFunnelModel')

  const {
    funnelInfoList,
  } = useQuery<IQuery>()

  const chart = useRef(null)
  const loading = useLoading()

  const resizeFn = useRef(() => {
    chart.current && chart.current.resize()
  })

  // 转化率展示类型
  const [showType, setShowType] = useState<'cumulative' | 'single'>('single')

  // 处理后的数据
  const chatData = useMemo(() => {
    if (!data.length) return []
    // TODO 先只取第一个维度数据
    return funnelInfoList.map((item, index) => {
      const isFirst = index === 0
      // 上一个值
      const prevItemValue = isFirst ? undefined : data[0][funnelInfoList[index-1].stepName] as number
      const conversionRate = isFirst ? undefined : (
        showType === 'single' ? (data[0][item.stepName] as number / prevItemValue) : (data[0][item.stepName] as number / (data[0][funnelInfoList[0].stepName] as number))
      )
      return {
        ...item,
        value: data[0][item.stepName] as number,
        conversionRate,
      }
    })
  }, [data, funnelInfoList, showType])

  const initECharts = useCallback(() => {
    if (chart.current) return
    chart.current = echarts.init(document.getElementById('charts'))
    chart.current.setOption({
      tooltip: {
        trigger: 'item',
      },
      toolbox: {
        feature: {
          dataView: { readOnly: false },
          restore: {},
          saveAsImage: {},
        },
      },
      legend: {
        data: ['Show', 'Click', 'Visit', 'Inquiry', 'Order'],
      },
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
            borderColor: '#fff',
            borderWidth: 1,
          },
          emphasis: {
            label: {
              fontSize: 20,
            },
          },
          data: [],
        },
      ],
    })
  }, [])

  useEffect(() => {
    initECharts()
    window.addEventListener('resize', resizeFn.current)
    return () => {
      window.removeEventListener('resize', resizeFn.current)
    }
  }, [])

  useEffect(() => {
    if (!chart.current) return
    if (loading.dataAnalysisFunnelModel.submitQuery) {
      chart.current.showLoading()
    } else {
      chart.current.hideLoading()
    }
  }, [loading.dataAnalysisFunnelModel.submitQuery])

  useEffect(() => {
    chart.current.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const { name, value, dataIndex } = params
          const s = echarts.format.encodeHTML(name) + '<b/>' + echarts.format.encodeHTML(value) + '<b/>转化率: '
          return s + ((chatData[dataIndex].conversionRate || 1) * 100).toFixed(2) + '%'
        },
      },
      series: [
        {
          data: chatData.map(info => ({
            value: info.value,
            name: info.stepName,
          })),
        },
      ],
    })
    return () => {
      if (!resizeFn.current) return
      window.removeEventListener('resize', resizeFn.current)
    }
  }, [chatData])

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
        <div id="charts" className={styles.chat} />
        {/* 数据详情区 */}
        <div className={styles.dataDetail}>
          <div className={styles.totalConversionRate}>
            总转化率：{chatData.length ? ((chatData[chatData.length - 1].value / chatData[0].value * 100).toFixed(2)) : '--'}%
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
