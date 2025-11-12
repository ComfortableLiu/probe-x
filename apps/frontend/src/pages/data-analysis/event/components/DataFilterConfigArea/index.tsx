import React, { memo, useCallback } from "react"
import { useRouter } from "@/hooks"
import { Button, message, Space } from 'antd'
import * as styles from "./styles.module.scss"
import { Refresh, Search } from "@icon-park/react"
import EventSelector from "./components/EventSelector"
import GlobalFilter from "./components/GlobalFilter"
import DimensionSelector from "./components/DimensionSelector"
import TimeRangeSelector from "./components/TimeRangeSelector"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"

function DataFilterConfigArea() {

  const dispatch = useDispatch<Dispatch>()

  const {
    refresh,
  } = useRouter()

  // 提交查询任务
  const submit = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisEventModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    dispatch.dataAnalysisEventModel.submitQuery()
  }, [dispatch.dataAnalysisEventModel])

  return (
    <div className={styles.container}>

      {/* 事件部分 */}
      <div className={styles.selectorContainer}>
        <div className={styles.title}>事件选择</div>
        <div className={styles.content}>
          <EventSelector />
        </div>
      </div>
      <div className={styles.hr} />

      {/* 全局筛选部分 */}
      <div className={styles.selectorContainer}>
        <div className={styles.title}>全局筛选</div>
        <div className={styles.content}>
          <GlobalFilter />
        </div>
      </div>
      <div className={styles.hr} />

      {/* 数据维度 */}
      <div className={styles.selectorContainer}>
        <div className={styles.title}>数据维度</div>
        <div className={styles.content}>
          <DimensionSelector />
        </div>
      </div>
      <div className={styles.hr} />

      {/* 时间范围 */}
      <div className={styles.selectorContainer}>
        <div className={styles.title}>时间范围</div>
        <div className={styles.content}>
          <TimeRangeSelector />
        </div>
      </div>
      <div className={styles.hr} />

      {/* 操作按钮 */}
      <div className={styles.selectorContainer}>
        <Space>
          <Button
            type="primary"
            size="large"
            onClick={() => submit()}
          >
            <Search style={{ display: 'flex' }} theme="outline" size="14" fill="#FFFFFF" />
            查询
          </Button>
          <Button
            type="default"
            size="large"
            onClick={() => refresh({})}
          >
            <Refresh style={{ display: 'flex' }} theme="outline" size="14" fill="#000000" />
            重置
          </Button>
        </Space>
      </div>
    </div>
  )
}

export default memo(DataFilterConfigArea)
