import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, Modal } from "antd"
import { IRoleEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateRoleReq, IUpdateRoleReq } from "../../type"
import { SystemRoleKey, SYSTEM_ROLE_CONFIGS } from "@/constant/permissions"

function RoleEditPopup(props: IRoleEditPopupProps) {
  const {
    role,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const loading = useLoading()

  const isEdit = useMemo(() => !!role, [role])
  const isSystemRole = useMemo(() => role?.isSystemRole || false, [role])
  const isSuperAdmin = useMemo(() => role?.roleKey === SystemRoleKey.SUPER_ADMIN, [role])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
    } else {
      form.setFieldsValue({
        roleKey: role?.roleKey,
        roleName: role?.roleName,
        description: role?.description,
      })
    }
  }, [role, form, isEdit, open])

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
    if (loading.systemConfigRoleManageModel.createRole || loading.systemConfigRoleManageModel.updateRole) return
    
    if (isEdit) {
      const data: IUpdateRoleReq = {
        id: role!.id,
        roleName: values.roleName,
        description: values.description,
      }
      await onSubmit(data)
    } else {
      const data: ICreateRoleReq = {
        roleKey: values.roleKey,
        roleName: values.roleName,
        description: values.description,
      }
      await onSubmit(data)
    }
    onClose()
  }, [onClose, onSubmit, loading, isEdit, role])

  return (
    <Modal
      title={isEdit ? '编辑角色' : '新增角色'}
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={loading.systemConfigRoleManageModel.createRole || loading.systemConfigRoleManageModel.updateRole}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading.systemConfigRoleManageModel.createRole || loading.systemConfigRoleManageModel.updateRole}
      >
        {!isEdit && (
          <Form.Item
            name="roleKey"
            label="角色标识"
            rules={[{
              required: true,
              message: "请输入角色标识",
            }, {
              pattern: /^[a-z_]+$/,
              message: "角色标识只能包含小写字母和下划线",
            }]}
          >
            <Input placeholder="请输入角色标识，如：custom_role" />
          </Form.Item>
        )}
        {isEdit && (
          <Form.Item
            label="角色标识"
          >
            <Input value={role?.roleKey} disabled />
          </Form.Item>
        )}
        <Form.Item
          name="roleName"
          label="角色名称"
          rules={[{
            required: true,
            message: "请输入角色名称",
          }]}
        >
          <Input 
            placeholder="请输入角色名称" 
            disabled={isSystemRole && isSuperAdmin}
          />
        </Form.Item>
        <Form.Item
          name="description"
          label="角色描述"
        >
          <Input.TextArea
            placeholder="请输入角色描述"
            autoSize={{ minRows: 3, maxRows: 5 }}
            disabled={isSystemRole && isSuperAdmin}
          />
        </Form.Item>
        {isSystemRole && (
          <Form.Item label="系统角色说明">
            <div style={{ color: '#999', fontSize: '12px' }}>
              {role?.roleKey && SYSTEM_ROLE_CONFIGS[role.roleKey as SystemRoleKey]?.description}
            </div>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default memo(RoleEditPopup)

