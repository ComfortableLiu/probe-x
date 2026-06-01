import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, InputNumber, Modal, Select } from "antd"
import { IDataSourceEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateDataSourceReq, IUpdateDataSourceReq } from "../../type"

function DataSourceEditPopup(props: IDataSourceEditPopupProps) {
  const { record, onClose, open, onSubmit } = props
  const [form] = Form.useForm()
  const loading = useLoading()
  const isEdit = useMemo(() => !!record, [record])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
      form.setFieldsValue({ port: 9000, datasourceType: 'clickhouse' })
    } else {
      form.setFieldsValue({
        datasourceName: record?.datasourceName,
        datasourceType: record?.datasourceType,
        host: record?.host,
        port: record?.port,
        database: record?.database,
        username: record?.username,
        description: record?.description,
      })
    }
  }, [record, form, isEdit, open])

  const handleOk = useCallback(() => {
    form.validateFields().then(() => form.submit()).catch(console.error)
  }, [form])

  const handleSubmit = useCallback(async (values: any) => {
    if (isEdit) {
      // 编辑时，密码为空则不提交，避免覆盖已有密码
      const { password, ...rest } = values
      const data: IUpdateDataSourceReq = { id: record!.id, ...rest }
      if (password) data.password = password
      await onSubmit(data)
    } else {
      const data: ICreateDataSourceReq = { ...values }
      await onSubmit(data)
    }
    onClose()
  }, [onClose, onSubmit, isEdit, record])

  const isLoading = loading.systemConfigDataSourceModel?.createDataSource || loading.systemConfigDataSourceModel?.updateDataSource

  return (
    <Modal
      title={isEdit ? '编辑数据源' : '新增数据源'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={isLoading}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isLoading}>
        <Form.Item name="datasourceName" label="数据源名称" rules={[{ required: true, message: "请输入数据源名称" }]}>
          <Input placeholder="请输入数据源名称" />
        </Form.Item>
        <Form.Item name="datasourceType" label="数据源类型" rules={[{ required: true, message: "请选择数据源类型" }]}>
          <Select placeholder="请选择数据源类型" options={[
            { label: 'ClickHouse', value: 'clickhouse' },
            { label: 'MySQL', value: 'mysql' },
            { label: 'PostgreSQL', value: 'postgresql' },
          ]} />
        </Form.Item>
        <Form.Item name="host" label="连接地址" rules={[{ required: true, message: "请输入连接地址" }]}>
          <Input placeholder="请输入连接地址" />
        </Form.Item>
        <Form.Item name="port" label="端口" rules={[{ required: true, message: "请输入端口" }]}>
          <InputNumber placeholder="请输入端口" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="database" label="数据库名" rules={[{ required: true, message: "请输入数据库名" }]}>
          <Input placeholder="请输入数据库名" />
        </Form.Item>
        <Form.Item name="username" label="用户名">
          <Input placeholder="请输入用户名" />
        </Form.Item>
        <Form.Item name="password" label="密码">
          <Input.Password placeholder={isEdit ? "不修改请留空" : "请输入密码"} />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="请输入描述" rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(DataSourceEditPopup)
