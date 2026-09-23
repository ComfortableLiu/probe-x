import React, { memo, useCallback, useEffect } from "react"
import { Form, Input, Modal } from "antd"
import { IEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { IUpdateUtmReq, UTM_DIMENSION_LABEL } from "@probe-x/shared-types/src"

function EditPopup(props: IEditPopupProps) {
  const { record, onClose, open, onSubmit } = props
  const [form] = Form.useForm()
  const loading = useLoading()
  const isLoading = loading.pointManageUtmModel?.updateUtm

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      alias: record?.alias || "",
      description: record?.description || "",
    })
  }, [record, form, open])

  const handleSubmit = useCallback(async (values: { alias?: string; description?: string }) => {
    const data: IUpdateUtmReq & { isDeleted?: boolean } = {
      id: record!.id,
      alias: values.alias,
      description: values.description,
      isDeleted: record!.isDeleted,
    }
    await onSubmit(data)
    onClose()
  }, [onClose, onSubmit, record])

  const handleOk = useCallback(() => {
    form.validateFields().then(() => form.submit()).catch(console.error)
  }, [form])

  return (
    <Modal
      title="编辑 UTM"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={isLoading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isLoading}>
        <Form.Item label="UTM 取值">
          <Input
            value={`${UTM_DIMENSION_LABEL[record?.dimension!]} = ${record?.value || ""}`}
            disabled
          />
        </Form.Item>
        <Form.Item
          name="alias"
          label="别名"
          extra="方便识别的可读名称，例如「2026春节微信投放」"
        >
          <Input placeholder="请输入别名" maxLength={255} />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="请输入描述" maxLength={500} rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(EditPopup)
