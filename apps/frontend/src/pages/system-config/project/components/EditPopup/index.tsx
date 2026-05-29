import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, Modal, Switch } from "antd"
import { IProjectEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateProjectReq, IUpdateProjectReq } from "../../type"

function ProjectEditPopup(props: IProjectEditPopupProps) {
  const { record, onClose, open, onSubmit } = props
  const [form] = Form.useForm()
  const loading = useLoading()
  const isEdit = useMemo(() => !!record, [record])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
      form.setFieldsValue({ isEnable: true })
    } else {
      form.setFieldsValue({
        projectName: record?.projectName,
        projectKey: record?.projectKey,
        description: record?.description,
        isEnable: record?.isEnable,
      })
    }
  }, [record, form, isEdit, open])

  const handleOk = useCallback(() => {
    form.validateFields().then(() => form.submit()).catch(console.error)
  }, [form])

  const handleSubmit = useCallback(async (values: any) => {
    if (isEdit) {
      const data: IUpdateProjectReq = { id: record!.id, ...values }
      await onSubmit(data)
    } else {
      const data: ICreateProjectReq = { ...values }
      await onSubmit(data)
    }
    onClose()
  }, [onClose, onSubmit, isEdit, record])

  const isLoading = loading.systemConfigProjectModel?.createProject || loading.systemConfigProjectModel?.updateProject

  return (
    <Modal
      title={isEdit ? '编辑项目' : '新增项目'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={isLoading}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isLoading}>
        <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: "请输入项目名称" }]}>
          <Input placeholder="请输入项目名称" />
        </Form.Item>
        <Form.Item
          name="projectKey"
          label="项目标识"
          rules={[
            { required: true, message: "请输入项目标识" },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/, message: "以字母开头，只能包含字母、数字、下划线和横线" },
          ]}
          extra="全局唯一，创建后不可修改"
        >
          <Input placeholder="例如: my-project" disabled={isEdit} />
        </Form.Item>
        <Form.Item name="isEnable" label="启用状态" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="请输入项目描述" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(ProjectEditPopup)
