import React, { useCallback, useMemo, useState } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Space, TableProps, Tag } from "antd"
import dayjs from "dayjs"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { ICreateSystemReq, IUpdateSystemReq, IDeleteSystemReq, ISystemListItem, ISystemManageState } from "./type"
import * as styles from "./styles.module.scss"
import SystemEditPopup from "./components/edit"

/**
 * 系统管理
 * 功能说明：管理系统信息，包括系统的创建、编辑、删除等操作
 * 用途：用于管理业务系统，系统与SPM第一层节点（业务线/站点）关联，用于实现系统维度的权限管理
 */
function SystemManage() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { systemList, pagination } = useModel<ISystemManageState>('systemConfigSystemManageModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState<ISystemListItem | null>(null)

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/system-config/system') {
      dispatch.systemConfigSystemManageModel.getSystemList()
    }
  })

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'systemKey',
    label: '系统标识',
    type: FormItemType.TEXT,
  }, {
    key: 'systemName',
    label: '系统名称',
    type: FormItemType.TEXT,
  }, {
    key: 'isEnable',
    label: '状态',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '启用', value: true },
      { label: '禁用', value: false },
    ],
  }], [])

  const handleEditSystem = useCallback((system: ISystemListItem) => {
    setSelectedSystem(system)
    setEditPopupOpen(true)
  }, [])

  const handleEditSubmit = useCallback(async (data: ICreateSystemReq | IUpdateSystemReq) => {
    // 只允许修改启用状态，其余字段由SPM管理
    if ((data as IUpdateSystemReq).id) {
      try {
        await dispatch.systemConfigSystemManageModel.updateSystem({
          id: (data as IUpdateSystemReq).id,
          isEnable: (data as IUpdateSystemReq).isEnable,
        })
        // 确保列表刷新完成后再关闭弹窗
        await dispatch.systemConfigSystemManageModel.getSystemList()
      } catch (error) {
        console.error('更新系统失败:', error)
      }
    }
  }, [dispatch])

  const columns: TableProps<ISystemListItem>['columns'] = useMemo(() => [
    {
      title: '系统标识',
      dataIndex: 'systemKey',
      width: 150,
      fixed: 'left',
    }, {
      title: '系统名称',
      dataIndex: 'systemName',
      width: 200,
    }, {
      title: '系统描述',
      dataIndex: 'description',
      width: 250,
      render: (text: string) => text || '-',
    }, {
      title: '关联SPM节点',
      dataIndex: 'trackingNodeName',
      width: 200,
      render: (text: string, record: ISystemListItem) => {
        if (record.trackingNodeCode) {
          return (
            <Space>
              <span>{text || record.trackingNodeCode}</span>
              {record.trackingNodeCode && (
                <Tag color="blue">{record.trackingNodeCode}</Tag>
              )}
            </Space>
          )
        }
        return '-'
      },
    }, {
      title: '状态',
      dataIndex: 'isEnable',
      width: 100,
      render: (isEnable: boolean) => (
        <Tag color={isEnable ? 'success' : 'error'}>
          {isEnable ? '启用' : '禁用'}
        </Tag>
      ),
    }, {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_: any, record: ISystemListItem) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleEditSystem(record)}
            disabled={loading.systemConfigSystemManageModel.updateSystem}
          >
            修改状态
          </Button>
        </Space>
      ),
    },
  ], [handleEditSystem, loading])

  return (
    <div className={styles.systemManage}>
      <h2>系统管理</h2>
      <p className={styles.description}>
        系统信息与SPM业务线/站点（第一层节点）强绑定，系统标识、名称、描述及关联SPM节点均由SPM管理页面维护。
        此处仅支持查看和修改系统启用状态，如需新增、修改或删除业务线，请前往SPM管理页面操作。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<ISystemListItem>
        exButtons={null}
        columns={columns}
        dataSource={systemList}
        loading={loading.systemConfigSystemManageModel.getSystemList}
        pagination={pagination}
        rowKey="id"
      />
      <SystemEditPopup
        system={selectedSystem}
        open={editPopupOpen}
        onClose={() => {
          setEditPopupOpen(false)
          setSelectedSystem(null)
        }}
        onSubmit={handleEditSubmit}
      />
    </div>
  )
}

export default SystemManage
