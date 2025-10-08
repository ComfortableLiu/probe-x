import React, { useEffect, useMemo } from "react"
import { Drawer, TableProps } from "antd"
import { Dispatch } from "@/store/storeContext"
import { useDispatch } from "react-redux"
import TableComponent from "@components/TableComponent"
import * as styles from './styles.module.scss'
import { IEventListItem } from "@probe-x/shared-types/src"
import dayjs from "dayjs"
import { IPropertyDetailProps } from "./type"
import { useLoading } from "@/hooks"

function PropertyDetail(props: IPropertyDetailProps) {

  const {
    property,
    onClose,
  } = props

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  const show = useMemo(() => !!property, [property])

  useEffect(() => {
    if (!show) return
    if (property?.events === undefined) {
      dispatch.pointManagePropertyModel.getPropertyEvents({ propertyName: property.propertyName })
    }
  }, [dispatch.pointManagePropertyModel, property, show])

  const columns = useMemo<TableProps<IEventListItem>['columns']>(() => [
    {
      title: '事件名',
      dataIndex: 'eventName',
      key: 'eventName',
      width: 150,
    }, {
      title: '事件别名',
      dataIndex: 'eventAliases',
      key: 'eventAliases',
      width: 80,
    }, {
      title: '事件描述',
      dataIndex: 'eventRemark',
      width: 250,
    }, {
      title: '事件中含义',
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

  if (!property) return null

  return (
    <Drawer
      title={property.propertyName}
      closable={{ 'aria-label': 'Close Button' }}
      width={600}
      onClose={onClose}
      open={show}
    >
      <div className={styles.container}>
        <h4 className={styles.title}>
          基本信息
        </h4>
        <div className={styles.propertyInfo}>
          {property.propertyType}
        </div>
        <h4 className={styles.title}>
          绑定事件
        </h4>
        <TableComponent<IEventListItem>
          style={{ padding: 0 }}
          dataSource={property?.events || []}
          columns={columns}
          loading={loading.pointManagePropertyModel.getPropertyEvents}
        />
      </div>
    </Drawer>
  )
}

export default PropertyDetail
