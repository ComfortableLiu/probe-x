import React, { memo, useCallback, useEffect, useState } from "react"
import { Form, Input, Modal, Select } from "antd"
import { ISystemEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateSystemReq, IUpdateSystemReq } from "../../type"
import { queryBusinessList } from "@pages/point-manage/spm/services"
import { IBusinessListItem } from "@probe-x/shared-types/src"

function SystemEditPopup(props: ISystemEditPopupProps) {
  const {
    system,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const loading = useLoading()
  const [businessList, setBusinessList] = useState<IBusinessListItem[]>([])

  const isEdit = !!system

  useEffect(() => {
    if (open && isEdit) {
      form.setFieldsValue({
        systemKey: system?.systemKey,
        systemName: system?.systemName,
        description: system?.description,
        trackingNodeCode: system?.trackingNodeCode,
        isEnable: system?.isEnable,
      })
    } else if (open && !isEdit) {
      form.resetFields()
    }
  }, [system, form, isEdit, open])

  useEffect(() => {
    if (open) {
      loadBusinessList()
    }
  }, [open])

  const loadBusinessList = async () => {
    try {
      const { data } = await queryBusinessList()
      setBusinessList(data || [])
    } catch (error) {
      console.error('获取业务线列表失败:', error)
    }
  }

  const handleOk = useCallback(() => {
    form.validateFields()
      .then(() => form.submit())
      .catch(err => {
        console.error(err)
      })
  }, [form])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async (values: any) => {
    if (loading.systemConfigSystemManageModel.updateSystem || !isEdit || !system) return

    const data: IUpdateSystemReq = {
      id: system.id,
      isEnable: values.isEnable,
    }
    await onSubmit(data)
    onClose()
  }, [onClose, onSubmit, loading, isEdit, system])

  return (
    <Modal
      title={isEdit ? '编辑系统' : '新增系统'}
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={loading.systemConfigSystemManageModel.createSystem || loading.systemConfigSystemManageModel.updateSystem}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading.systemConfigSystemManageModel.createSystem || loading.systemConfigSystemManageModel.updateSystem}
      >
        {isEdit && (
          <Form.Item
            label="系统标识"
          >
            <Input value={system?.systemKey} disabled />
          </Form.Item>
        )}
        <Form.Item
          name="systemName"
          label="系统名称"
          rules={[]}
        >
          <Input placeholder="系统名称由SPM业务线维护" disabled />
        </Form.Item>
        <Form.Item
          name="description"
          label="系统描述"
        >
          <Input.TextArea
            placeholder="系统描述由SPM业务线维护"
            autoSize={{ minRows: 3, maxRows: 5 }}
            disabled
          />
        </Form.Item>
        <Form.Item
          name="trackingNodeCode"
          label="关联SPM节点（业务线/站点）"
          tooltip="关联SPM第一层节点（业务线/站点），用于实现系统与业务线的联动"
        >
          <Select
            placeholder="SPM业务线由SPM管理页面维护"
            allowClear={false}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={businessList.map(item => ({
              label: `${item.name} (${item.code})`,
              value: item.code,
            }))}
            disabled
          />
        </Form.Item>
        {isEdit && (
          <Form.Item
            name="isEnable"
            label="是否启用"
          >
            <Select
              options={[
                { label: '启用', value: true },
                { label: '禁用', value: false },
              ]}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default memo(SystemEditPopup)
