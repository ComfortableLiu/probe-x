import React, { useEffect, useMemo } from "react"
import { Drawer, TableProps } from "antd"
import type { IEventDetailProps } from "./type"
import { Dispatch } from "@/store/storeContext"
import { useDispatch } from "react-redux"
import TableComponent from "@components/TableComponent"
import * as styles from './styles.module.scss'
import { ICommonPropertyListItem, IPropertyListItem } from "@probe-x/shared-types/src"
import dayjs from "dayjs"
import { useLoading, useModel } from "@/hooks"
import { IStaticState } from "@/store/models/static/type"

function SpmDetail(props: IEventDetailProps) {

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

  useEffect(() => {
    if (!show) return
    if (event?.properties === undefined) {
      dispatch.pointManageEventModel.getEventProperties({ eventName: event.eventName })
    }
  }, [dispatch.pointManageEventModel, event, show])

  const columns = useMemo<TableProps<IPropertyListItem>['columns']>(() => [
    {
      title: '属性名',
      dataIndex: 'propertyName',
      key: 'propertyName',
      width: 150,
    }, {
      title: '属性类型',
      dataIndex: 'propertyType',
      key: 'propertyType',
      width: 80,
    }, {
      title: '业务类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: text => {
        switch (text) {
          case 1:
            return '业务属性'
          case 2:
            return '系统属性'
        }
      },
    }, {
      title: '属性说明',
      dataIndex: 'eventPropertyRemark',
      key: 'eventPropertyRemark',
      width: 250,
    }, {
      title: '创建人',
      dataIndex: 'createNickname',
      key: 'createNickname',
      width: 150,
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 150,
      render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    }, {
      title: '更新人',
      dataIndex: 'updateNickname',
      key: 'updateNickname',
      width: 150,
    }, {
      title: '更新时间',
      dataIndex: 'updateTime',
      key: 'updateTime',
      render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
      width: 150,
    }], [])

  const commonPropertyColumns = useMemo<TableProps<ICommonPropertyListItem>['columns']>(() => [
    {
      title: '属性名',
      dataIndex: 'propertyName',
      key: 'propertyName',
      width: 150,
    }, {
      title: '属性类型',
      dataIndex: 'propertyType',
      key: 'propertyType',
      width: 80,
    }], [])

  if (!event) return null

  return (
    <Drawer
      title={event.eventName}
      closable={{ 'aria-label': 'Close Button' }}
      width={600}
      onClose={onClose}
      open={show}
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
        <h4 className={styles.title}>
          业务参数
        </h4>
        <TableComponent<IPropertyListItem>
          style={{ padding: 0 }}
          dataSource={event?.properties || []}
          columns={columns}
          loading={loading.pointManageEventModel.getEventProperties}
        />
      </div>
    </Drawer>
  )
}

export default SpmDetail
