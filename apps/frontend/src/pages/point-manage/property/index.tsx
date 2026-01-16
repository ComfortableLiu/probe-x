import React, { useCallback, useMemo, useState } from "react"
import { FormItemType } from "@components/FormComponent/constants"
import { IFormItem } from "@components/FormComponent/type"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { Button, Space, TableProps } from "antd"
import dayjs from "dayjs"
import { IPointManagePropertyState, IPropertyListItem } from "@pages/point-manage/property/type"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import PropertyDetail from "@pages/point-manage/property/components/detail"
import { MetaPropertyBusinessType } from "@probe-x/shared-types/src"
import { AddOne } from "@icon-park/react"
import PageHeader from "@components/PageHeader"
import * as styles from "./styles.module.scss"

function PropertyManage() {

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  const {
    propertyList,
  } = useModel<IPointManagePropertyState>('pointManagePropertyModel')

  const [selectedProperty, setSelectedProperty] = useState<IPropertyListItem | null>(null)

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/point-manage/property') {
      dispatch.pointManagePropertyModel.getPropertyList()
    }
  })

  const handleRefresh = useCallback(() => {
    dispatch.pointManagePropertyModel.getPropertyList()
  }, [dispatch])

  const openPropertyDetail = useCallback((property: IPropertyListItem) => {
    setSelectedProperty(property)
  }, [])

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'propertyName',
    label: '属性名',
    type: FormItemType.TEXT,
  }, {
    key: 'type',
    label: '展示公参',
    type: FormItemType.CHECKBOX,
  }, {
    key: 'status',
    label: '属性状态',
    type: FormItemType.TEXT,
    disabled: true,
  }], [])

  const columns: TableProps<IPropertyListItem>['columns'] = useMemo(() => [
    {
      title: '属性名',
      dataIndex: 'propertyName',
      width: 200,
      fixed: 'left',
      render: (text, record) => <a onClick={() => openPropertyDetail(record)}>{text}</a>,
    }, {
      title: '类型',
      dataIndex: 'propertyType',
      width: 100,
    }, {
      title: '是否公参',
      dataIndex: 'type',
      width: 80,
      render: (text) => text === MetaPropertyBusinessType.COMMON ? '是' : '否',
    }, {
      title: '创建人',
      dataIndex: 'createNickname',
      width: 120,
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 200,
      render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    }, {
      title: '更新人',
      dataIndex: 'updateNickname',
      width: 120,
    }, {
      title: '更新时间',
      dataIndex: 'updateTime',
      render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
      width: 200,
    }, {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <a onClick={() => openPropertyDetail(record)}>详情</a>
        </Space>
      ),
    },
  ], [openPropertyDetail])

  const handleAddProperty = useCallback(() => {
    // TODO 增加属性
  }, [])

  return (
    <div className={styles.container}>
      <PageHeader
        title="属性管理"
        onRefresh={handleRefresh}
        loading={loading.pointManagePropertyModel.getPropertyList}
      />
      <FormComponent
        formItems={formItems}
      />
      <TableComponent<IPropertyListItem>
        exButtons={(
          <Button
            type="primary"
            onClick={() => handleAddProperty()}
          >
            新增属性
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        )}
        dataSource={propertyList}
        columns={columns}
        loading={loading.pointManagePropertyModel.getPropertyList}
      />
      <PropertyDetail
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
    </div>
  )
}

export default PropertyManage
