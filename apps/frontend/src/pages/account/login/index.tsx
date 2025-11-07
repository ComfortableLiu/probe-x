import React, { useCallback } from "react"
import { Button, Card, Form, Input, message } from "antd"
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import * as styles from './styles.module.scss'
import { useLoading, useQuery } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { hmacSHA } from "@utils/encryption"
import { get } from "@config"

function Login() {
  const { redirectUri } = useQuery()

  const dispatch = useDispatch<Dispatch>()

  const loading = useLoading()

  const onFinish = useCallback(async (values: any) => {
    const passwordHash = await hmacSHA(values.password + get('ssoPasswordSalt'), '512', get('ssoPasswordSecret'))
    try {
      await dispatch.userModel.login({
        username: values.username,
        password: passwordHash,
      })

      // 这里应该调用登录API
      message.success('登录成功')

      setTimeout(() => {
        if (redirectUri) {
          window.location.replace(redirectUri)
        } else {
          window.location.replace('/')
        }
      }, 1000)
    } catch (e) {
      message.error('登录失败')
    }
  }, [dispatch.userModel, redirectUri])

  return (
    <div className={styles.loginContainer}>
      <Card
        title="用户登录"
        className={styles.loginCard}
      >
        <Form
          name="normal_login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          disabled={loading.userModel.login}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input
              prefix={<UserOutlined className="site-form-item-icon" />}
              placeholder="用户名"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input
              prefix={<LockOutlined className="site-form-item-icon" />}
              type="password"
              placeholder="密码"
            />
          </Form.Item>
          {/*<Form.Item>*/}
          {/*  <Form.Item name="remember" valuePropName="checked" noStyle>*/}
          {/*    <Checkbox>30天免登录</Checkbox>*/}
          {/*  </Form.Item>*/}
          {/*</Form.Item>*/}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className={styles.loginButton}
              loading={loading.userModel.login}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Login
