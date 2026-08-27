import React, { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Form, Input, Modal, Select } from "antd"
import { IRoleEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { ICreateRoleReq, IUpdateRoleReq } from "../../type"
import { SystemRoleKey, SYSTEM_ROLE_CONFIGS } from "@/constant/permissions"
import { querySystemOptions } from "../../../system/services"
import { ISystemOption } from "@probe-x/shared-types/src"

function RoleEditPopup(props: IRoleEditPopupProps) {
  const {
    role,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const loading = useLoading()
  const [systemOptions, setSystemOptions] = useState<ISystemOption[]>([])

  const isEdit = useMemo(() => !!role, [role])
  const isSystemRole = useMemo(() => role?.isSystemRole || false, [role])
  const isSuperAdmin = useMemo(() => role?.roleKey === SystemRoleKey.SUPER_ADMIN, [role])

  useEffect(() => {
    if (open) {
      loadSystemOptions()
    }
  }, [open])

  const loadSystemOptions = async () => {
    try {
      const { data } = await querySystemOptions()
      setSystemOptions(data || [])
    } catch (error) {
      console.error('获取系统选项失败:', error)
    }
  }

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
    } else {
      form.setFieldsValue({
        roleKey: role?.roleKey,
        roleName: role?.roleName,
        description: role?.description,
        systemId: role?.systemId ?? null,
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
        systemId: values.systemId !== undefined ? (values.systemId || null) : undefined,
      }
      await onSubmit(data)
    } else {
      const data: ICreateRoleReq = {
        roleKey: values.roleKey,
        roleName: values.roleName,
        description: values.description,
        systemId: values.systemId || null,
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
      destroyOnClose
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
        {!isSystemRole && (
          <Form.Item
            name="systemId"
            label="所属系统"
            tooltip="选择系统后，该角色将成为系统级角色；不选择则为全局角色"
          >
            <Select
              placeholder="请选择系统（可选，不选择则为全局角色）"
              allowClear
              options={[
                { label: '全局角色', value: null },
                ...systemOptions.map(opt => ({
                  label: `${opt.systemName} (${opt.systemKey})`,
                  value: opt.id,
                })),
              ]}
            />
          </Form.Item>
        )}
        {isSystemRole && (
          <Form.Item label="系统角色说明">
            <div style={{ color: 'var(--px-color-text-tertiary)', fontSize: '12px' }}>
              {role?.roleKey && SYSTEM_ROLE_CONFIGS[role.roleKey as SystemRoleKey]?.description}
            </div>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default memo(RoleEditPopup)

