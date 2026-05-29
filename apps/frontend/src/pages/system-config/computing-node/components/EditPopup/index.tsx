import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, InputNumber, Modal, Select } from "antd"
import { IComputeNodeEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateComputeNodeReq, IUpdateComputeNodeReq } from "../../type"

function ComputeNodeEditPopup(props: IComputeNodeEditPopupProps) {
  const { record, onClose, open, onSubmit } = props
  const [form] = Form.useForm()
  const loading = useLoading()
  const isEdit = useMemo(() => !!record, [record])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
      form.setFieldsValue({ nodeType: 'grpc', weight: 100 })
    } else {
      form.setFieldsValue({
        nodeName: record?.nodeName,
        nodeAddress: record?.nodeAddress,
        nodePort: record?.nodePort,
        nodeType: record?.nodeType,
        weight: record?.weight,
        description: record?.description,
      })
    }
  }, [record, form, isEdit, open])

  const handleOk = useCallback(() => {
    form.validateFields().then(() => form.submit()).catch(console.error)
  }, [form])

  const handleSubmit = useCallback(async (values: any) => {
    if (isEdit) {
      const data: IUpdateComputeNodeReq = { id: record!.id, ...values }
      await onSubmit(data)
    } else {
      const data: ICreateComputeNodeReq = { ...values }
      await onSubmit(data)
    }
    onClose()
  }, [onClose, onSubmit, isEdit, record])

  const isLoading = loading.systemConfigComputeNodeModel?.createNode || loading.systemConfigComputeNodeModel?.updateNode

  return (
    <Modal
      title={isEdit ? '编辑计算节点' : '新增计算节点'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={isLoading}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isLoading}>
        <Form.Item name="nodeName" label="节点名称" rules={[{ required: true, message: "请输入节点名称" }]}>
          <Input placeholder="请输入节点名称" />
        </Form.Item>
        <Form.Item name="nodeAddress" label="节点地址" rules={[{ required: true, message: "请输入节点地址" }]}>
          <Input placeholder="例如: 192.168.1.100" />
        </Form.Item>
        <Form.Item name="nodePort" label="端口" rules={[{ required: true, message: "请输入端口" }]}>
          <InputNumber placeholder="例如: 50051" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="nodeType" label="节点类型" rules={[{ required: true, message: "请选择节点类型" }]}>
          <Select options={[{ label: 'gRPC', value: 'grpc' }]} />
        </Form.Item>
        <Form.Item name="weight" label="权重">
          <InputNumber min={1} max={1000} placeholder="默认100" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="请输入描述" rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(ComputeNodeEditPopup)
