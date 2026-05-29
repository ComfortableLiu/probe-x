import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, Modal, Select, Switch } from "antd"
import { IRuleEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateAlertRuleReq, IUpdateAlertRuleReq } from "../../type"

const ruleTypeOptions = [
  { label: '事件量异常波动', value: 'event_count_spike' },
  { label: '漏斗转化率下降', value: 'funnel_conversion_drop' },
  { label: '自定义规则', value: 'custom' },
]

const defaultConditions: Record<string, string> = {
  event_count_spike: JSON.stringify({ metric: 'event_count', threshold: 50, direction: 'up', windowMinutes: 60 }, null, 2),
  funnel_conversion_drop: JSON.stringify({ metric: 'funnel_conversion', threshold: 10, direction: 'down', windowMinutes: 1440 }, null, 2),
  custom: JSON.stringify({ expression: '', threshold: 0 }, null, 2),
}

function RuleEditPopup(props: IRuleEditPopupProps) {
  const { record, onClose, open, onSubmit } = props
  const [form] = Form.useForm()
  const loading = useLoading()
  const isEdit = useMemo(() => !!record, [record])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
      form.setFieldsValue({ isEnable: true, ruleType: 'event_count_spike', condition: defaultConditions.event_count_spike })
    } else {
      form.setFieldsValue({
        ruleName: record?.ruleName,
        ruleType: record?.ruleType,
        condition: record?.condition,
        notificationId: record?.notificationId,
        isEnable: record?.isEnable,
        description: record?.description,
      })
    }
  }, [record, form, isEdit, open])

  const handleOk = useCallback(() => {
    form.validateFields().then(() => form.submit()).catch(console.error)
  }, [form])

  const handleSubmit = useCallback(async (values: any) => {
    if (isEdit) {
      const data: IUpdateAlertRuleReq = { id: record!.id, ...values }
      await onSubmit(data)
    } else {
      const data: ICreateAlertRuleReq = { ...values }
      await onSubmit(data)
    }
    onClose()
  }, [onClose, onSubmit, isEdit, record])

  const handleRuleTypeChange = useCallback((value: string) => {
    form.setFieldsValue({ condition: defaultConditions[value] || '' })
  }, [form])

  const isLoading = loading.systemConfigAlertModel?.createAlertRule || loading.systemConfigAlertModel?.updateAlertRule

  return (
    <Modal
      title={isEdit ? '编辑告警规则' : '新增告警规则'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={isLoading}
      width={700}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isLoading}>
        <Form.Item name="ruleName" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
          <Input placeholder="例如: 事件量异常波动告警" />
        </Form.Item>
        <Form.Item name="ruleType" label="规则类型" rules={[{ required: true, message: "请选择规则类型" }]}>
          <Select options={ruleTypeOptions} onChange={handleRuleTypeChange} />
        </Form.Item>
        <Form.Item
          name="condition"
          label="规则条件（JSON）"
          rules={[{ required: true, message: "请输入规则条件" }]}
          extra="配置告警触发的阈值和条件"
        >
          <Input.TextArea rows={4} placeholder='{"metric": "event_count", "threshold": 50, "direction": "up"}' />
        </Form.Item>
        <Form.Item name="notificationId" label="通知配置ID" extra="关联的通知配置，告警触发时通过该配置发送通知">
          <Input type="number" placeholder="请输入通知配置ID（可选）" />
        </Form.Item>
        <Form.Item name="isEnable" label="启用状态" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="请输入规则描述" rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(RuleEditPopup)
