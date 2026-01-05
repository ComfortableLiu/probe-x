import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, Modal, Switch } from "antd"
import { IUserEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateUserReq, IUpdateUserReq } from "../../type"

function UserEditPopup(props: IUserEditPopupProps) {
  const {
    user,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const loading = useLoading()

  const isEdit = useMemo(() => !!user, [user])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
      form.setFieldsValue({
        isActive: true,
      })
    } else {
      form.setFieldsValue({
        username: user?.username,
        email: user?.email,
        nickname: user?.nickname,
        isActive: user?.isActive !== false,
      })
    }
  }, [user, form, isEdit, open])

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
    if (loading.systemConfigUserManageModel.createUser || loading.systemConfigUserManageModel.updateUser) return
    
    if (isEdit) {
      const data: IUpdateUserReq = {
        userId: user!.userId!,
        email: values.email,
        nickname: values.nickname,
        isActive: values.isActive,
      }
      await onSubmit(data)
    } else {
      const data: ICreateUserReq = {
        username: values.username,
        password: values.password,
        email: values.email,
        nickname: values.nickname,
        isActive: values.isActive !== false,
      }
      await onSubmit(data)
    }
    onClose()
  }, [onClose, onSubmit, loading, isEdit, user])

  return (
    <Modal
      title={isEdit ? '编辑用户' : '新增用户'}
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={loading.systemConfigUserManageModel.createUser || loading.systemConfigUserManageModel.updateUser}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading.systemConfigUserManageModel.createUser || loading.systemConfigUserManageModel.updateUser}
      >
        {!isEdit && (
          <Form.Item
            name="username"
            label="用户名"
            rules={[{
              required: true,
              message: "请输入用户名",
            }, {
              pattern: /^[a-zA-Z0-9_]{3,20}$/,
              message: "用户名只能包含字母、数字和下划线，长度3-20位",
            }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
        )}
        {!isEdit && (
          <Form.Item
            name="password"
            label="密码"
            rules={[{
              required: true,
              message: "请输入密码",
            }, {
              min: 6,
              message: "密码长度至少6位",
            }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
        )}
        <Form.Item
          name="email"
          label="邮箱"
          rules={[{
            type: 'email',
            message: "请输入有效的邮箱地址",
          }]}
        >
          <Input placeholder="请输入邮箱" />
        </Form.Item>
        <Form.Item
          name="nickname"
          label="昵称"
        >
          <Input placeholder="请输入昵称" />
        </Form.Item>
        <Form.Item
          name="isActive"
          label="状态"
          valuePropName="checked"
        >
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(UserEditPopup)

