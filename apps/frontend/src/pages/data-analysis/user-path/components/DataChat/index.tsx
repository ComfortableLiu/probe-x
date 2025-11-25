import React, { memo, useCallback, useEffect, useRef } from "react"
import * as echarts from "echarts"
import * as styles from "./styles.module.scss"
import { useLoading, useModel } from "@/hooks"
import { IDataAnalysisUserPathState } from "@pages/data-analysis/user-path/type"

function DataChat() {

  const {
    data,
  } = useModel<IDataAnalysisUserPathState>('dataAnalysisUserPathModel')

  const chart = useRef(null)
  const loading = useLoading()

  const resizeFn = useRef(() => {
    chart.current && chart.current.resize()
  })

  const initECharts = useCallback(() => {
    if (chart.current) return
    chart.current = echarts.init(document.getElementById('charts'))
    chart.current.setOption({
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
      },
      animation: false,
      series: [
        {
          type: 'sankey',
          emphasis: {
            focus: 'adjacency',
          },
          nodeAlign: 'right',
          data: [],
          links: [],
          lineStyle: {
            color: 'source',
            curveness: 0.5,
          },
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
        formatter: '{a}: {b}',
      },
      series: [
        {
          data: data?.eventList || [],
          links: data?.edgeList || [],
        },
      ],
    })
  }, [data])

  return (
    <div id="charts" className={styles.chat} />
  )
}


export default memo(DataChat)
