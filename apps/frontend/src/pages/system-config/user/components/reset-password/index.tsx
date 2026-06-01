import React, { memo, useCallback, useEffect } from "react"
import { Form, Input, Modal } from "antd"
import { IResetPasswordPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { IResetPasswordReq } from "../../type"

function ResetPasswordPopup(props: IResetPasswordPopupProps) {
  const {
    user,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const loading = useLoading()

  useEffect(() => {
    if (!open) {
      form.resetFields()
    }
  }, [form, open])

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

  const handleSubmit = useCallback(async (values: { newPassword: string, confirmPassword: string }) => {
    if (loading.systemConfigUserManageModel.resetPassword || !user) return
    
    const data: IResetPasswordReq = {
      userId: user.userId!,
      newPassword: values.newPassword,
    }
    await onSubmit(data)
    onClose()
  }, [onClose, onSubmit, loading, user])

  return (
    <Modal
      destroyOnClose
      title="重置密码"
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={loading.systemConfigUserManageModel.resetPassword}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading.systemConfigUserManageModel.resetPassword}
      >
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[{
            required: true,
            message: "请输入新密码",
          }, {
            min: 6,
            message: "密码长度至少6位",
          }]}
        >
          <Input.Password placeholder="请输入新密码" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认密码"
          dependencies={['newPassword']}
          rules={[{
            required: true,
            message: "请确认密码",
          }, ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('newPassword') === value) {
                return Promise.resolve()
              }
              return Promise.reject(new Error('两次输入的密码不一致'))
            },
          })]}
        >
          <Input.Password placeholder="请再次输入密码" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(ResetPasswordPopup)

