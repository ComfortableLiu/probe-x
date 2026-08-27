import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, InputNumber, Modal, Select, Switch } from "antd"
import { IRuleEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateAlertRuleReq, IUpdateAlertRuleReq } from "../../type"

const operatorOptions = [
  { label: '大于（>）', value: '>' },
  { label: '小于（<）', value: '<' },
  { label: '大于等于（>=）', value: '>=' },
  { label: '小于等于（<=）', value: '<=' },
  { label: '等于（==）', value: '==' },
]

const levelOptions = [
  { label: '提示', value: 'info' },
  { label: '警告', value: 'warning' },
  { label: '严重', value: 'critical' },
]

function RuleEditPopup(props: IRuleEditPopupProps) {
  const { record, onClose, open, onSubmit } = props
  const [form] = Form.useForm()
  const loading = useLoading()
  const isEdit = useMemo(() => !!record, [record])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
      form.setFieldsValue({ enabled: true, operator: '>', level: 'warning', windowMinutes: 60, checkIntervalMinutes: 5 })
    } else {
      form.setFieldsValue({
        name: record?.name,
        eventName: record?.eventName,
        windowMinutes: record?.windowMinutes,
        checkIntervalMinutes: record?.checkIntervalMinutes,
        operator: record?.operator,
        threshold: record?.threshold,
        level: record?.level,
        webhookUrl: record?.webhookUrl,
        enabled: record?.enabled,
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

  const isLoading = loading.systemDataAlertModel?.createAlertRule || loading.systemDataAlertModel?.updateAlertRule

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
        <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
          <Input placeholder="例如: 下单事件量异常告警" />
        </Form.Item>
        <Form.Item name="eventName" label="监控事件" rules={[{ required: true, message: "请输入监控事件名称" }]} extra="对应埋点上报的事件名称（$event_name）">
          <Input placeholder="例如: $pageview" />
        </Form.Item>
        <Form.Item name="windowMinutes" label="统计时间窗（分钟）" rules={[{ required: true, message: "请输入统计时间窗" }]}>
          <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="例如: 60" />
        </Form.Item>
        <Form.Item name="checkIntervalMinutes" label="巡检间隔（分钟）" rules={[{ required: true, message: "请输入巡检间隔" }]} extra="系统每隔该时长检查一次该规则">
          <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="例如: 5" />
        </Form.Item>
        <Form.Item name="operator" label="比较条件" rules={[{ required: true, message: "请选择比较条件" }]}>
          <Select options={operatorOptions} />
        </Form.Item>
        <Form.Item name="threshold" label="阈值" rules={[{ required: true, message: "请输入阈值" }]} extra="时间窗内事件次数与阈值比较，满足条件即触发">
          <InputNumber min={0} style={{ width: '100%' }} placeholder="例如: 100" />
        </Form.Item>
        <Form.Item name="level" label="告警级别" rules={[{ required: true, message: "请选择告警级别" }]}>
          <Select options={levelOptions} />
        </Form.Item>
        <Form.Item
          name="webhookUrl"
          label="Webhook 地址"
          rules={[{ required: true, message: "请输入 Webhook 地址" }, { type: 'url', message: "请输入合法的 URL" }]}
          extra="告警触发时向该地址 POST 告警内容"
        >
          <Input placeholder="https://example.com/webhook" />
        </Form.Item>
        <Form.Item name="enabled" label="启用状态" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(RuleEditPopup)
