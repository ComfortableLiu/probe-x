import React, { memo, useCallback, useEffect, useState } from "react"
import { Form, Modal, Select, message } from "antd"
import { IDashboardEditPopupProps } from "../edit/type"
import { IDashboard } from "../../type"
import { convertToPublicDashboard } from "../../services"

interface IConvertToPublicPopupProps {
  dashboard?: IDashboard
  open: boolean
  onClose: () => void
  onSubmit: () => Promise<void>
}

function ConvertToPublicPopup(props: IConvertToPublicPopupProps) {
  const {
    dashboard,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  // 这里应该从系统中获取所有角色列表，简化处理，先不实现
  const [roleOptions] = useState([
    { label: 'data_analyst', value: 'data_analyst' },
    { label: 'developer', value: 'developer' },
    // 可以添加更多角色
  ])

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      permissions: dashboard?.permissions || [],
    })
  }, [dashboard, form, open])

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
    if (loading || !dashboard?.id) return
    setLoading(true)

    try {
      const { data: res } = await convertToPublicDashboard({
        id: dashboard.id,
        permissions: values.permissions || [],
      })
      message.success('转换成功')
      await onSubmit()
    } catch (error: any) {
      message.error(error?.msg || '转换失败')
    } finally {
      setLoading(false)
    }
  }, [onClose, onSubmit, loading, dashboard])

  return (
    <Modal
      title="转为公共看板"
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      confirmLoading={loading}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading}
      >
        <Form.Item label="看板名称">
          <div>{dashboard?.name}</div>
        </Form.Item>
        <Form.Item
          name="permissions"
          label="可查看的角色"
          tooltip="选择可以查看此公共看板的角色，留空表示所有用户都可以查看"
        >
          <Select
            mode="multiple"
            placeholder="请选择可查看的角色（可选）"
            options={roleOptions}
            allowClear
          />
        </Form.Item>
        <Form.Item label="说明">
          <div style={{ color: '#999', fontSize: '12px' }}>
            转为公共看板后，所有拥有相应权限的用户都可以查看此看板。您仍然可以编辑此看板，但删除权限需要管理员权限。
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(ConvertToPublicPopup)
