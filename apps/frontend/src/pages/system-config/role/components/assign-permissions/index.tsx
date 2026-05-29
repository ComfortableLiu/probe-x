import React, { memo, useCallback, useEffect, useState } from "react"
import { Form, Modal } from "antd"
import { IAssignPermissionsPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { IAssignPermissionsReq, IPermissionOption } from "../../type"
import { queryPermissionList, queryRolePermissionIds } from "../../services"
import { SystemRoleKey } from "@/constant/permissions"
import PermissionTree from "@/components/PermissionTree"

function AssignPermissionsPopup(props: IAssignPermissionsPopupProps) {
  const {
    role,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const loading = useLoading()
  const [permissionList, setPermissionList] = useState<IPermissionOption[]>([])
  const [loadingPermissions, setLoadingPermissions] = useState(false)

  const isSuperAdmin = role?.roleKey === SystemRoleKey.SUPER_ADMIN

  useEffect(() => {
    if (open) {
      loadPermissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    if (role) {
      loadRolePermissions()
    } else {
      form.setFieldsValue({
        permissionIds: [],
      })
    }
  }, [role, form, open])

  const loadRolePermissions = async () => {
    if (!role) return
    try {
      const { data } = await queryRolePermissionIds(role.id)
      form.setFieldsValue({
        permissionIds: data || [],
      })
    } catch (error) {
      console.error('获取角色权限失败:', error)
      form.setFieldsValue({
        permissionIds: [],
      })
    }
  }

  const loadPermissions = async () => {
    setLoadingPermissions(true)
    try {
      const { data } = await queryPermissionList()
      setPermissionList(data.data || [])
    } catch (error) {
      console.error('获取权限列表失败:', error)
    } finally {
      setLoadingPermissions(false)
    }
  }

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

  const handleSubmit = useCallback(async (values: { permissionIds: number[] }) => {
    if (loading.systemConfigRoleManageModel.assignPermissions || !role) return
    
    const data: IAssignPermissionsReq = {
      roleId: role.id,
      permissionIds: values.permissionIds || [],
    }
    await onSubmit(data)
    onClose()
  }, [onClose, onSubmit, loading, role])

  return (
    <Modal
      title="分配权限"
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={loading.systemConfigRoleManageModel.assignPermissions}
      width={800}
      destroyOnClose
    >
      {isSuperAdmin && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fff7e6', borderRadius: 4, color: '#d46b08' }}>
          超管角色拥有所有权限，无需分配
        </div>
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading.systemConfigRoleManageModel.assignPermissions || isSuperAdmin}
      >
        <Form.Item
          name="permissionIds"
          label="权限"
          rules={[{
            required: false,
          }]}
          valuePropName="checkedKeys"
          trigger="onCheck"
        >
          <PermissionTree
            permissionList={permissionList}
            loading={loadingPermissions}
            checkable
            defaultExpandAll
            treeProps={{
              style: {
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '8px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
              },
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(AssignPermissionsPopup)

