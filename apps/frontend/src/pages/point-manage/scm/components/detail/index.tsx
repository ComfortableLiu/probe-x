import React, { useMemo } from "react"
import { Drawer } from "antd"
import type { IEventDetailProps } from "./type"
import { Dispatch } from "@/store/storeContext"
import { useDispatch } from "react-redux"
import * as styles from './styles.module.scss'
import { useLoading, useModel } from "@/hooks"
import { IStaticState } from "@/store/models/static/type"

function ScmDetail(props: IEventDetailProps) {

  const {
    event,
    onClose,
  } = props

  const {
    commonPropertyList = [],
  } = useModel<IStaticState>('staticModel')

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  const show = useMemo(() => !!event, [event])

  if (!event) return null

  return (
    <Drawer
      title={event.eventName}
      closable={{ 'aria-label': 'Close Button' }}
      width={600}
      onClose={onClose}
      open={show}
      destroyOnClose
    >
      {/*容器*/}
      <div className={styles.container}>
        <h4 className={styles.title}>
          基本信息
        </h4>
        <div className={styles.eventInfo}>
          {event.eventAliases}
          {event.eventRemark}
          {event.status}
        </div>
      </div>
    </Drawer>
  )
}

export default ScmDetail
