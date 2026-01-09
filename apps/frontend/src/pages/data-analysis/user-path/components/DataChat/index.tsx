import React, { memo, useCallback, useEffect, useRef, useState } from "react"
import * as echarts from "echarts"
import * as styles from "./styles.module.scss"
import { useLoading, useModel } from "@/hooks"
import { IDataAnalysisUserPathState } from "@pages/data-analysis/user-path/type"
import { Button } from "antd"
import { DownPicture } from "@icon-park/react"

function DataChat() {

  const {
    data,
  } = useModel<IDataAnalysisUserPathState>('dataAnalysisUserPathModel')

  const chart = useRef(null)
  const loading = useLoading()
  const [isDownloading, setIsDownloading] = useState(false) // 下载中状态

  // 统计每个节点的总流量（流出次数总和，用于节点内部展示）
  const calculateNodeTotalValue = (edgeList: any[]) => {
    const nodeTotalMap = new Map<string, number>()
    edgeList.forEach(link => {
      const { source, value } = link
      if (!source || value <= 0) return
      // 累加每个节点的流出总次数
      nodeTotalMap.set(source, (nodeTotalMap.get(source) || 0) + value)
    })
    return nodeTotalMap
  }

  // 核心：下载图表为图片
  const downloadChart = useCallback(() => {
    if (!chart.current || isDownloading) return
    setIsDownloading(true)

    try {
      // 1. 配置下载参数（高清图片）
      const chartInstance = chart.current
      const options = {
        type: 'png', // 下载格式：png（默认），可改为 jpg
        pixelRatio: 2, // 像素比（2倍高清，避免模糊）
        backgroundColor: '#fff', // 背景色（默认透明，改为白色更美观）
        excludeComponents: ['toolbox'], // 排除不需要的组件
      }

      // 2. ECharts 生成图片URL
      const dataUrl = chartInstance.getDataURL(options)

      // 3. 创建隐藏a标签触发下载
      const link = document.createElement('a')
      link.href = dataUrl
      // 文件名：用户路径分析_时间戳.格式
      const timestamp = new Date().toISOString().replace(/[-:\.T]/g, '')
      link.download = `用户路径分析图表_${timestamp}.${options.type}`
      document.body.appendChild(link)
      link.click()

      // 4. 移除a标签，避免内存泄漏
      setTimeout(() => {
        document.body.removeChild(link)
        setIsDownloading(false)
      }, 100)
    } catch (error) {
      console.error('图表下载失败：', error)
      setIsDownloading(false)
      alert('下载失败，请重试！')
    }
  }, [isDownloading])

  const resizeFn = useRef(() => {
    if (chart.current) {
      chart.current.resize()
      chart.current.setOption({
        series: [{
          roam: true,
          scaleLimit: { min: 0.3, max: 3 },
        }],
      })
    }
  })

  const initECharts = useCallback(() => {
    if (chart.current) return
    const chartDom = document.getElementById('charts')
    if (!chartDom) return
    chart.current = echarts.init(chartDom)
    chart.current.setOption({
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: any) => {
          const getOriginalName = (name: string) => name.replace(/_\d+$/, '')

          if (params.dataType === 'link') {
            const sourceName = getOriginalName(params.sourceName)
            const targetName = getOriginalName(params.targetName)
            return `
              <div style="padding: 4px 8px; max-width: 250px;">
                <div style="font-weight: 600; margin-bottom: 2px;">流转路径</div>
                <div>源事件：${sourceName}</div>
                <div>目标事件：${targetName}</div>
                <div>流转次数：${params.value}</div>
              </div>
            `
          }

          const nodeName = getOriginalName(params.name)
          const nodeTotal = params.data.totalValue || 0
          return `
            <div style="padding: 4px 8px;">
              <div>事件：${nodeName}</div>
              <div>总流出次数：${nodeTotal}</div>
            </div>
          `
        },
      },
      animation: false,
      series: [
        {
          type: 'sankey',
          emphasis: {
            focus: 'adjacency',
            itemStyle: {
              borderColor: '#333',
              borderWidth: 2,
            },
          },
          nodeAlign: 'right',
          roam: true,
          scaleLimit: { min: 0.3, max: 3 },
          nodeWidth: 120,
          nodeHeight: 40,
          nodeGap: 25,
          data: [],
          links: [],
          lineStyle: {
            color: 'source',
            curveness: 0.4,
            opacity: 0.7,
          },
          itemStyle: {
            borderRadius: 4,
            borderColor: '#eee',
            borderWidth: 1,
          },
          label: {
            position: 'inside',
            align: 'center',
            verticalAlign: 'middle',
            fontSize: 11,
            formatter: (params: any) => {
              const originalName = params.name.replace(/_\d+$/, '')
              const totalValue = params.data.totalValue || 0
              return `{name|${originalName}}\n{value|${totalValue}}`
            },
            rich: {
              name: {
                fontSize: 11,
                color: '#333',
                lineHeight: 16,
                textAlign: 'center',
                width: '100%',
              },
              value: {
                fontSize: 10,
                color: '#666',
                lineHeight: 14,
                textAlign: 'center',
              },
            },
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
      if (chart.current) {
        chart.current.dispose()
        chart.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chart.current) return
    if (loading.dataAnalysisUserPathModel.submitQuery) {
      chart.current.showLoading()
    } else {
      chart.current.hideLoading()
    }
  }, [loading.dataAnalysisUserPathModel.submitQuery])

  useEffect(() => {
    if (!chart.current || !data) return
    const nodeTotalMap = calculateNodeTotalValue(data.edgeList || [])
    const processedNodes = (data?.eventList || []).map(event => ({
      name: event,
      totalValue: nodeTotalMap.get(event) || 0,
      itemStyle: {},
    }))
    const filteredLinks = (data?.edgeList || []).filter(link => link.value >= 5)

    chart.current.setOption({
      series: [
        {
          data: processedNodes,
          links: filteredLinks,
        },
      ],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return (
    <div className={styles.chatWrapper}>
      {/* 下载按钮：悬浮在图表右上角 */}
      <Button
        className={styles.downloadBtn}
        onClick={downloadChart}
        type="primary"
        disabled={!data || isDownloading || !chart.current}
        title={isDownloading ? '下载中...' : '下载图表（PNG）'}
        loading={isDownloading}
      >
        {isDownloading ? null : <DownPicture theme="outline" size="16" fill="#FFFFFF" />}
        {isDownloading ? '下载中…' : '下载图片'}
      </Button>
      {/* 图表容器 */}
      <div id="charts" className={styles.chat} />
    </div>
  )
}

export default memo(DataChat)
