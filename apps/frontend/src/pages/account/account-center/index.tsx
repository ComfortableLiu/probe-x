import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Row, Col, Form, Input, Button, message, Space, Tag, Collapse, List, Typography } from "antd"
import { EditOutlined, SaveOutlined, CloseOutlined, LockOutlined, UserOutlined, SafetyOutlined } from "@ant-design/icons"
import { useModel, useLoading } from "@/hooks"
import { useDispatch } from "react-redux"
import { IUserModel } from "@/store/models/user/type"
import { Dispatch } from "@/store/storeContext"
import { IUser } from "@probe-x/shared-types/src"
import dayjs from "dayjs"
import * as styles from "./styles.module.scss"

const { Panel } = Collapse
const { Text, Title } = Typography

/**
 * 个人中心
 * 功能说明：查看和修改当前登录用户的个人信息
 * 用途：用户管理自己的账户信息，包括邮箱、昵称和密码修改
 */
function AccountCenter() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { userInfo, permissionInfo } = useModel<IUserModel>('userModel')
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [isEditing, setIsEditing] = useState(false)
  const [activeKey, setActiveKey] = useState<string | string[]>([])

  useEffect(() => {
    if (userInfo) {
      form.setFieldsValue({
        email: userInfo.email,
        nickname: userInfo.nickname,
      })
    }
  }, [userInfo, form])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    if (userInfo) {
      form.setFieldsValue({
        email: userInfo.email,
        nickname: userInfo.nickname,
      })
    }
  }, [form, userInfo])

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields()
      await dispatch.userModel.updateProfile(values)
      message.success('个人信息更新成功')
      setIsEditing(false)
    } catch (error) {
      console.error('更新失败:', error)
    }
  }, [dispatch, form])

  const handleChangePassword = useCallback(async () => {
    try {
      const values = await passwordForm.validateFields()
      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的密码不一致')
        return
      }
      await dispatch.userModel.changePassword({
        oldPassword: values.oldPassword, // 可能是undefined（首次设置）
        newPassword: values.newPassword,
      })
      message.success('密码修改成功，请重新登录')
      passwordForm.resetFields()
      setActiveKey([])
      // 延迟跳转到登录页，让用户看到成功提示
      setTimeout(() => {
        window.location.href = '/login'
      }, 1500)
    } catch (error: any) {
      message.error(error?.msg || '密码修改失败')
    }
  }, [dispatch, passwordForm])

  const handleCancelChangePassword = useCallback(() => {
    passwordForm.resetFields()
    setActiveKey([])
  }, [passwordForm])

  const roles = useMemo(() => {
    return permissionInfo?.roles || []
  }, [permissionInfo])

  const permissions = useMemo(() => {
    return permissionInfo?.allPermissions || []
  }, [permissionInfo])

  return (
    <div className={styles.accountCenter}>
      <Title level={2}>个人中心</Title>
      
      <Row gutter={[24, 24]}>
        {/* 左侧：基本信息 */}
        <Col xs={24} lg={16}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <Title level={4}>
                <UserOutlined /> 基本信息
              </Title>
              {!isEditing ? (
                <Button
                  type="primary"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                >
                  编辑
                </Button>
              ) : (
                <Space>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={handleCancelEdit}
                  >
                    取消
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={loading.userModel.updateProfile}
                  >
                    保存
                  </Button>
                </Space>
              )}
            </div>

            {!isEditing ? (
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <Text type="secondary">用户名</Text>
                  <Text strong>{userInfo?.username || '-'}</Text>
                </div>
                <div className={styles.infoItem}>
                  <Text type="secondary">邮箱</Text>
                  <Text>{userInfo?.email || '-'}</Text>
                </div>
                <div className={styles.infoItem}>
                  <Text type="secondary">昵称</Text>
                  <Text>{userInfo?.nickname || '-'}</Text>
                </div>
                <div className={styles.infoItem}>
                  <Text type="secondary">状态</Text>
                  <div style={{ width: 'fit-content' }}>
                    <Tag color={userInfo?.isActive ? 'success' : 'error'}>
                      {userInfo?.isActive ? '启用' : '禁用'}
                    </Tag>
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <Text type="secondary">最后登录</Text>
                  <Text>
                    {userInfo?.lastLogin ? dayjs(userInfo.lastLogin).format('YYYY-MM-DD HH:mm:ss') : '-'}
                  </Text>
                </div>
                <div className={styles.infoItem}>
                  <Text type="secondary">创建时间</Text>
                  <Text>
                    {userInfo?.createdAt ? dayjs(userInfo.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                  </Text>
                </div>
              </div>
            ) : (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                className={styles.editForm}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="email"
                      label="邮箱"
                      rules={[
                        { type: 'email', message: '请输入有效的邮箱地址' },
                      ]}
                    >
                      <Input placeholder="请输入邮箱" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="nickname"
                      label="昵称"
                      rules={[
                        { max: 50, message: '昵称长度不能超过50个字符' },
                      ]}
                    >
                      <Input placeholder="请输入昵称" />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}
          </div>

          {/* 安全设置 - 使用折叠面板 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <Title level={4}>
                <SafetyOutlined /> 安全设置
              </Title>
            </div>
            <Collapse
              activeKey={activeKey}
              onChange={setActiveKey}
              ghost
            >
              <Panel
                header="修改密码"
                key="changePassword"
                extra={<LockOutlined />}
              >
                <Form
                  form={passwordForm}
                  layout="vertical"
                  onFinish={handleChangePassword}
                  className={styles.passwordForm}
                >
                  {userInfo?.username === 'admin' && (
                    <Form.Item
                      name="oldPassword"
                      label="旧密码（首次设置密码可不填）"
                      tooltip="如果是首次设置密码，可以不填写旧密码"
                    >
                      <Input.Password placeholder="请输入旧密码（首次设置可不填）" />
                    </Form.Item>
                  )}
                  {userInfo?.username !== 'admin' && (
                    <Form.Item
                      name="oldPassword"
                      label="旧密码"
                      rules={[
                        { required: true, message: '请输入旧密码' },
                      ]}
                    >
                      <Input.Password placeholder="请输入旧密码" />
                    </Form.Item>
                  )}
                  <Form.Item
                    name="newPassword"
                    label="新密码"
                    rules={[
                      { required: true, message: '请输入新密码' },
                      { min: 6, message: '密码长度至少6个字符' },
                    ]}
                  >
                    <Input.Password placeholder="请输入新密码" />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true, message: '请确认新密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) {
                            return Promise.resolve()
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'))
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="请再次输入新密码" />
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button
                        type="primary"
                        onClick={handleChangePassword}
                        loading={loading.userModel.changePassword}
                      >
                        保存
                      </Button>
                      <Button onClick={handleCancelChangePassword}>
                        取消
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Panel>
            </Collapse>
          </div>
        </Col>

        {/* 右侧：角色和权限 */}
        <Col xs={24} lg={8}>
          {/* 角色列表 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <Title level={4}>角色</Title>
            </div>
            {roles.length > 0 ? (
              <List
                size="small"
                dataSource={roles}
                renderItem={(role) => (
                  <List.Item>
                    <Tag color="blue">{role.roleName}</Tag>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {role.roleKey}
                    </Text>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无角色</Text>
            )}
          </div>

          {/* 权限列表 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <Title level={4}>权限</Title>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                共 {permissions.length} 项
              </Text>
            </div>
            {permissions.length > 0 ? (
              <div className={styles.permissionList}>
                {permissions.map((permission) => (
                  <div key={permission.permissionKey} className={styles.permissionItem}>
                    <Text strong style={{ fontSize: '13px' }}>
                      {permission.permissionName}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      {permission.permissionKey}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">暂无权限</Text>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default AccountCenter
