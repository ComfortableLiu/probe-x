import React, { memo, useCallback, useMemo, useState } from "react"
import { useQuery, useRouter } from "@/hooks"
import { IFunnelInfo } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"
import { AddOne } from "@icon-park/react"
import FunnelItem from "./components/FunnelItem"
import { IQuery } from "@pages/data-analysis/funnel/type"
import EditPopup
  from "@pages/data-analysis/funnel/components/DataFilterConfigArea/components/FunnelList/components/EditPopup"

function FunnelList() {

  const {
    funnelInfoList = [],
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  // 展示编辑弹窗
  const [showEditPopup, setShowEditPopup] = useState<boolean>(false)
  // 编辑弹窗内容，为空则为新增
  const [editFunnelInfo, setEditFunnelInfo] = useState<IFunnelInfo | null>(null)
  // 编辑弹窗的索引，<0为新增
  const [editFunnelIndex, setEditFunnelIndex] = useState<number>(-1)

  // 移除第index个事件
  const removeEvent = useCallback((index: number) => {
    const list = [...funnelInfoList]
    list.splice(index, 1)
    refresh({
      funnelInfoList: list,
    }, true)
  }, [funnelInfoList, refresh])

  // 新增一个指标
  const addFunnel = useCallback(() => {
    setShowEditPopup(true)
    setEditFunnelInfo(null)
    setEditFunnelIndex(-1)
  }, [])

  // 复制一个指标
  const copyFunnel = useCallback((index: number) => {
    const list = [...funnelInfoList]
    // 把第index个元素复制插入到第index+1的位置
    list.splice(index + 1, 0, { ...list[index] })
    refresh({
      funnelInfoList: list,
    }, true)
  }, [funnelInfoList, refresh])

  // 渲染事件选项列表
  const renderFunnelList = useMemo(() => {
    return funnelInfoList.map((funnelInfo, index) => (
      <FunnelItem
        key={index}
        funnelInfo={funnelInfo}
        index={index}
        onRemove={() => removeEvent(index)}
        onCopy={() => copyFunnel(index)}
        onEdit={(value) => {
          setEditFunnelInfo(value)
          setEditFunnelIndex(index)
          setShowEditPopup(true)
        }}
      />
    ))
  }, [copyFunnel, funnelInfoList, removeEvent])

  return (
    <div className={styles.container}>
      {renderFunnelList}
      <a
        className={styles.addBtn}
        href="#"
        onClick={() => addFunnel()}
      >
        <AddOne theme="filled" size="24" fill="#536DFE" style={{ display: 'flex' }} />
        添加指标
      </a>

      <EditPopup
        show={showEditPopup}
        funnelInfo={editFunnelInfo}
        index={editFunnelIndex}
        onClose={() => {
          setShowEditPopup(false)
        }}
        onChange={(value, index) => {
          if (index < 0) {
            const list = [...funnelInfoList, value]
            refresh({
              funnelInfoList: list,
            }, true)
          }else{
            const list = [...funnelInfoList]
            list[index] = value
            refresh({
              funnelInfoList: list,
            }, true)
          }
          setShowEditPopup(false)
          setEditFunnelInfo(null)
          setEditFunnelIndex(-1)
        }}
      />
    </div>
  )
}

export default memo(FunnelList)
