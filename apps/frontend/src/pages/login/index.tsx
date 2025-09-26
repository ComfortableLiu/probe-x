import React, { useCallback, useState } from "react"
import { Button, Card, Checkbox, Form, Input, message } from "antd"
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import * as styles from './styles.module.scss'
import { useQuery } from "@/hooks"
import { useNavigate } from "react-router"
import { Localstorage } from "@utils/storage"
import { KEY_ACCESS_TOKEN } from "@/constant/storage"
import { delay } from "@shared-utils"

function Login() {

  const navigate = useNavigate()
  const { redirect } = useQuery<{ redirect?: string }>()

  const [loading, setLoading] = useState(false)

  const onFinish = useCallback(async (values: any) => {
    setLoading(true)
    try {
      await delay(1000)
      // TODO 模拟登录
      Localstorage.set(KEY_ACCESS_TOKEN, '12312312')

      // 这里应该调用登录API
      message.success('登录成功')

      setTimeout(() => {
        if (redirect) {
          navigate(redirect, { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      }, 1000)
    } catch (e) {
      message.error('登录失败')
    } finally {
      setLoading(false)
    }
  }, [navigate, redirect])

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
          disabled={loading}
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
          <Form.Item>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>30天免登录</Checkbox>
            </Form.Item>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className={styles.loginButton}
              loading={loading}
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