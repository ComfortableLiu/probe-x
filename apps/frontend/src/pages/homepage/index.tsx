import React, { useCallback, useEffect } from "react"
import { Spin } from "antd"
import PageHeader from "@components/PageHeader"
import { useModel, useHistoryListener } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IHomepageState } from "./type"
import StatCards from "./components/StatCards"
import TrendChart from "./components/TrendChart"
import EventTable from "./components/EventTable"
import * as styles from "./styles.module.scss"

const Homepage = () => {
  const { loading, overview, trend, realtimeEvents } = useModel<IHomepageState>('homepageModel')
  const dispatch = useDispatch<Dispatch>()

  const loadData = useCallback(() => {
    dispatch.homepageModel.fetchHomepageData()
  }, [dispatch])

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/' || pathname === '/home' || pathname === '/homepage' || pathname === '/index') {
      loadData()
    }
  })

  const handleRefresh = useCallback(() => {
    loadData()
  }, [loadData])

  return (
    <div className={styles.homepage}>
      <PageHeader
        title="数据看板"
        onRefresh={handleRefresh}
        loading={loading}
      />

      <Spin spinning={loading}>
        {/* 核心统计卡片 */}
        <StatCards overview={overview} />

        {/* 趋势图表 */}
        <TrendChart trend={trend} />

        {/* 实时事件流 */}
        <EventTable
          realtimeEvents={realtimeEvents}
          loading={loading}
          onRefresh={() => dispatch.homepageModel.fetchRealtimeEvents()}
        />
      </Spin>
    </div>
  )
}

export default Homepage
