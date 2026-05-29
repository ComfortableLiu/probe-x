import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, Modal } from "antd"
import { IAnyObj } from "@probe-x/shared-types/src"
import { ISpmScmEditPopupProps } from "./type"

function SpmScmEditPopup(props: ISpmScmEditPopupProps) {

  const {
    open,
    nodeName,
    selectedNodeData,
    onClose,
    parentNode,
    parentNodeName,
    level,
    loading,
    onSubmit,
  } = props

  const [form] = Form.useForm()

  const isEdit = useMemo(() => !!selectedNodeData, [selectedNodeData])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
    } else {
      form.setFieldsValue(selectedNodeData)
    }
  }, [selectedNodeData, form, isEdit, open])

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

  const handleSubmit = useCallback(async (value: IAnyObj) => {
    if (loading) return
    await onSubmit(value)
    onClose()
  }, [onClose, onSubmit, loading])

  return (
    <Modal
      title={isEdit ? '编辑' : '新增'}
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading}
        initialValues={{
          parentCode: parentNode?.code,
          code: selectedNodeData?.code,
          level: selectedNodeData?.level || level || (parentNode?.level || 0) + 1,
        }}
      >
        <Form.Item hidden name="level" />
        {parentNode ?
          <Form.Item
            label={parentNodeName || '所属节点'}
            name="parentCode"
          >
            {parentNode?.name}（{parentNode?.code}）
          </Form.Item>
          : null}
        {isEdit ?
          <Form.Item
            name="code"
            label={`${nodeName}编码`}
          >
            {selectedNodeData?.code}
          </Form.Item>
          : null}
        <Form.Item
          required
          label={`${nodeName}名称`}
          name="name"
          rules={[{
            required: true,
            message: `请输入${nodeName}名称`,
          }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={`${nodeName}描述`}
          name="description"
        >
          <Input.TextArea
            autoSize={{ minRows: 5, maxRows: 5 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(SpmScmEditPopup)
