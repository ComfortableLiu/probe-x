import React, { memo, useEffect, useRef } from "react"
import * as echarts from "echarts"

export default memo(DataChat)

function DataChat() {

  const chart = useRef(null)

  const resizeFn = useRef(() => {
    chart.current && chart.current.resize()
  })

  useEffect(() => {
    chart.current = echarts.init(document.getElementById('charts'))
    chart.current.setOption({
      xAxis: {
        data: [],
      },
      yAxis: {},
      series: [
        {
          type: 'bar',
          data: [],
        },
      ],
      toolbox: {
        show: true,
        feature: {
          magicType: {
            show: true,
            type: ['line', 'bar', 'pei', 'stack'],
          },
          saveAsImage: {
            show: true,
          },
        },
      },
      tooltip: {
        trigger: 'axis', // 按轴触发（折线图必备）
        triggerOn: 'mousemove', // 鼠标移动时显示示意线（默认是 click，需修改）
        axisPointer: {
          type: 'cross', // 十字形示意线（水平+垂直）
          lineStyle: {
            color: '#999', // 示意线颜色
            width: 1, // 线宽
            type: 'solid', // 线型（solid/dashed/dotted）
          },
          label: {
            show: true, // 显示示意线对应的轴数值标签
            backgroundColor: 'rgba(0,0,0,0.5)', // 标签背景色
            color: '#fff', // 标签文字色
            fontSize: 11,
          },
        },
        // 可选：让 X/Y 轴示意线联动
        link: [{
          xAxisIndex: 'all', // 联动所有 X 轴
        }],
      },
    })
    window.addEventListener('resize', resizeFn.current)
    return () => {
      window.removeEventListener('resize', resizeFn.current)
    }
  }, [])

  useEffect(() => {
    chart.current.showLoading()
    setTimeout(() => {
      chart.current.hideLoading()
      chart.current.setOption({
        xAxis: {
          data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        },
        series: [
          {
            name: '销量',
            data: [23, 24, 18, 25, 27, 28, 25],
          },
        ],
      })
    }, 1000)
  }, [])

  return (
    <div>
      <h3>图形展示</h3>
      <div id="charts" style={{ width: '100%', height: 500 }} />
    </div>
  )
}
