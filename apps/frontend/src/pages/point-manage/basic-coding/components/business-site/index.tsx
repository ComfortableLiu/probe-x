import React, { useCallback, useMemo, useState } from "react"
import TableComponent from "@components/TableComponent"
import * as styles from "./styles.module.scss"
import { Button, Space, TableProps, Tag, Typography } from "antd"
import { AddOne } from "@icon-park/react"
import {
  IBusinessListItem,
  ICreateBusinessSiteReq,
  ITrackingListItem,
  IUpdateBusinessSiteReq,
  TrackingNodeStatus,
} from "@probe-x/shared-types/src"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IPointManageBasicCodingState } from "../../type"
import SpmScmEditPopup from "@pages/point-manage/components/SpmScmEditPopup"

function BusinessSite() {

  const { Paragraph } = Typography

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  const {
    businessList = [],
  } = useModel<IPointManageBasicCodingState>('pointManageBasicCodingModel')

  const [showEditBusinessSitePopup, setShowEditAddBusinessSitePopup] = useState(false)
  const [selectedBusinessSite, setSelectedBusinessSite] = useState<IBusinessListItem>()

  useHistoryListener((location) => {
    if (location.pathname === '/point-manage/basic-coding') {
      dispatch.pointManageBasicCodingModel.init()
    }
  })

  const showEditPopup = useCallback((data?: IBusinessListItem) => {
    setSelectedBusinessSite(data)
    setShowEditAddBusinessSitePopup(true)
  }, [])

  const hideEditPopup = useCallback(() => {
    setSelectedBusinessSite(undefined)
    setShowEditAddBusinessSitePopup(false)
  }, [])

  const columns = useMemo<TableProps<IBusinessListItem>['columns']>(() => [
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      fixed: 'left',
      render: (text) => (
        <Paragraph copyable>{text}</Paragraph>
      ),
    }, {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    }, {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 500,
      render: (description) => (
        <Typography.Paragraph
          style={{ whiteSpace: 'break-spaces' }}
          ellipsis={{
            rows: 3,
            expandable: 'collapsible',
          }}
        >
          {description}
        </Typography.Paragraph>
      ),
    }, {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => {
        const isValid = status === TrackingNodeStatus.VALID
        return (
          <div>
            <Tag color={isValid ? 'green' : 'error'}>{isValid ? '启用' : '禁用'}</Tag>
          </div>
        )
      },
    }, {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <a href="#" onClick={() => showEditPopup(record)}>编辑</a>
        </Space>
      ),
    },
  ], [Paragraph, showEditPopup])

  const handleSubmit = useCallback(async (value: ICreateBusinessSiteReq | IUpdateBusinessSiteReq) => {
    if (!!selectedBusinessSite) {
      await dispatch.pointManageBasicCodingModel.updateBusiness(value as IUpdateBusinessSiteReq)
    } else {
      await dispatch.pointManageBasicCodingModel.createBusiness(value as ICreateBusinessSiteReq)
    }
  }, [dispatch.pointManageBasicCodingModel, selectedBusinessSite])

  return (
    <div className={styles.container}>
      <Space>
        <Button
          onClick={() => showEditPopup()}
          type="primary"
        >
          添加
          <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
        </Button>
      </Space>
      <TableComponent<IBusinessListItem>
        dataSource={businessList}
        columns={columns}
        style={{ padding: 0 }}
        loading={loading.pointManageBasicCodingModel.getBusinessLines}
      />


      <SpmScmEditPopup
        open={showEditBusinessSitePopup}
        onClose={hideEditPopup}
        nodeName="业务线/站点"
        selectedNodeData={selectedBusinessSite as ITrackingListItem}
        onSubmit={(value: ICreateBusinessSiteReq | IUpdateBusinessSiteReq) => handleSubmit(value)}
      />
    </div>
  )
}

export default BusinessSite
