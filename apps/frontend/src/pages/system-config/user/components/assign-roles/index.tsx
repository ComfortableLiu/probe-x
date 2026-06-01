import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Modal, Select } from "antd"
import { IAssignRolesPopupProps } from "./type"
import { useLoading, useModel } from "@/hooks"
import { IAssignRolesReq, IUserManageState } from "../../type"

function AssignRolesPopup(props: IAssignRolesPopupProps) {
  const {
    user,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const loading = useLoading()
  const { roleList } = useModel<IUserManageState>('systemConfigUserManageModel')

  useEffect(() => {
    if (!open) return
    if (user) {
      form.setFieldsValue({
        roleIds: user.roleIds || [],
      })
    }
  }, [user, form, open])

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

  const handleSubmit = useCallback(async (values: { roleIds: number[] }) => {
    if (loading.systemConfigUserManageModel.assignRoles || !user) return
    
    const data: IAssignRolesReq = {
      userId: user.userId!,
      roleIds: values.roleIds || [],
    }
    await onSubmit(data)
    onClose()
  }, [onClose, onSubmit, loading, user])

  const roleOptions = useMemo(() => {
    return roleList.map(role => ({
      label: role.roleName,
      value: role.id,
    }))
  }, [roleList])

  return (
    <Modal
      destroyOnClose
      title="分配角色"
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={loading.systemConfigUserManageModel.assignRoles}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading.systemConfigUserManageModel.assignRoles}
      >
        <Form.Item
          name="roleIds"
          label="角色"
          rules={[{
            required: false,
          }]}
        >
          <Select
            mode="multiple"
            placeholder="请选择角色"
            options={roleOptions}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(AssignRolesPopup)

