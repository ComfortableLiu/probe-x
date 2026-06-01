import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, Modal, Select, Switch } from "antd"
import { INotificationEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateNotificationReq, IUpdateNotificationReq } from "../../type"

function NotificationEditPopup(props: INotificationEditPopupProps) {
  const { record, onClose, open, onSubmit } = props
  const [form] = Form.useForm()
  const loading = useLoading()
  const isEdit = useMemo(() => !!record, [record])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
      form.setFieldsValue({ isEnable: true, notificationType: 'webhook' })
    } else {
      form.setFieldsValue({
        notificationName: record?.notificationName,
        notificationType: record?.notificationType,
        recipients: record?.recipients,
        triggerCondition: record?.triggerCondition,
        config: record?.config,
        isEnable: record?.isEnable,
        description: record?.description,
      })
    }
  }, [record, form, isEdit, open])

  const handleOk = useCallback(() => {
    form.validateFields().then(() => form.submit()).catch(console.error)
  }, [form])

  const handleSubmit = useCallback(async (values: any) => {
    const submitData = { ...values, config: values.config || '{}' }
    if (isEdit) {
      const data: IUpdateNotificationReq = { id: record!.id, ...submitData }
      await onSubmit(data)
    } else {
      const data: ICreateNotificationReq = { ...submitData }
      await onSubmit(data)
    }
    onClose()
  }, [onClose, onSubmit, isEdit, record])

  const isLoading = loading.systemConfigNotificationModel?.createNotification || loading.systemConfigNotificationModel?.updateNotification

  return (
    <Modal
      title={isEdit ? '编辑通知配置' : '新增通知配置'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={isLoading}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isLoading}>
        <Form.Item name="notificationName" label="通知名称" rules={[{ required: true, message: "请输入通知名称" }]}>
          <Input placeholder="请输入通知名称" />
        </Form.Item>
        <Form.Item name="notificationType" label="通知类型" rules={[{ required: true, message: "请选择通知类型" }]}>
          <Select options={[
            { label: 'Webhook', value: 'webhook' },
            { label: '邮件', value: 'email' },
            { label: '短信', value: 'sms' },
          ]} />
        </Form.Item>
        <Form.Item name="recipients" label="接收人" rules={[{ required: true, message: "请输入接收人" }]}
          extra="Webhook 填写 URL，邮件填写邮箱地址，短信填写手机号">
          <Input placeholder="请输入接收人" />
        </Form.Item>
        <Form.Item name="triggerCondition" label="触发条件">
          <Input placeholder="例如: 数据处理失败时通知" />
        </Form.Item>
        <Form.Item name="config" label="配置（JSON）" extra={'Webhook: {"url":"..."}，邮件: {"smtp":"..."}'}>
          <Input.TextArea placeholder='{"url":"https://example.com/webhook"}' rows={3} />
        </Form.Item>
        <Form.Item name="isEnable" label="启用状态" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="请输入描述" rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(NotificationEditPopup)
