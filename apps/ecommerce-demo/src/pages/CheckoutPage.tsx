import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Typography, Divider, List, message, Row, Col } from 'antd'
import { mockUser } from '../data/mockData'
import { trackPageView, trackButtonClick, trackPurchase } from '../utils/probeX'

const { Title, Text } = Typography
const { TextArea } = Input

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const [orderItems, setOrderItems] = useState<any[]>([])
  const [paymentMethod, setPaymentMethod] = useState('alipay')
  const [shippingAddress, setShippingAddress] = useState(mockUser.address[0])

  useEffect(() => {
    if (location.state?.items) {
      setOrderItems(location.state.items)
      trackPageView('checkout', {
        page_title: '结算页面',
        items_count: location.state.items.length,
        total_amount: calculateTotalAmount(location.state.items),
      })
    } else {
      navigate('/cart')
    }
  }, [location.state])

  const calculateTotalAmount = (items: any[]) => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value)
    trackButtonClick('payment_method_change', 'checkout', {
      payment_method: value,
    })
  }

  const handleAddressChange = (value: string) => {
    const address = mockUser.address.find(addr => addr.id === value)
    if (address) {
      setShippingAddress(address)
      trackButtonClick('address_change', 'checkout', {
        address_id: value,
      })
    }
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)

    try {
      // 模拟提交订单
      await new Promise(resolve => setTimeout(resolve, 2000))

      const order = {
        id: Date.now().toString(),
        orderNumber: `ORD${Date.now()}`,
        items: orderItems,
        totalAmount: calculateTotalAmount(orderItems),
        paymentMethod,
        shippingAddress,
        ...values,
      }

      trackPurchase(order, { source: 'checkout' })

      message.success('订单提交成功！')
      navigate('/orders', { state: { order } })
    } catch (error) {
      message.error('订单提交失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (orderItems.length === 0) {
    return <div>加载中...</div>
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>确认订单</Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {/* 收货地址 */}
            <Card title="收货地址" style={{ marginBottom: '24px' }}>
              <Form.Item label="选择地址" required>
                <Select
                  value={shippingAddress.id}
                  onChange={handleAddressChange}
                  style={{ width: '100%' }}
                >
                  {mockUser.address.map(addr => (
                    <Select.Option key={addr.id} value={addr.id}>
                      {addr.name} {addr.phone} {addr.province} {addr.city} {addr.district} {addr.address}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Card>

            {/* 支付方式 */}
            <Card title="支付方式" style={{ marginBottom: '24px' }}>
              <Form.Item required>
                <Select
                  value={paymentMethod}
                  onChange={handlePaymentMethodChange}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="alipay">支付宝</Select.Option>
                  <Select.Option value="wechat">微信支付</Select.Option>
                  <Select.Option value="bank">银行卡</Select.Option>
                </Select>
              </Form.Item>
            </Card>

            {/* 备注 */}
            <Card title="订单备注" style={{ marginBottom: '24px' }}>
              <Form.Item name="remark">
                <TextArea
                  rows={4}
                  placeholder="请输入订单备注（选填）"
                />
              </Form.Item>
            </Card>
          </Form>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="订单详情">
            <List
              dataSource={orderItems}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <Text strong>{item.product.name}</Text>
                      <br />
                      <Text type="secondary">数量: {item.quantity}</Text>
                    </div>
                    <Text strong>¥{(item.product.price * item.quantity).toFixed(2)}</Text>
                  </div>
                </List.Item>
              )}
            />

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <Text>商品总价:</Text>
              <Text>¥{calculateTotalAmount(orderItems).toFixed(2)}</Text>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <Text>运费:</Text>
              <Text>¥0.00</Text>
            </div>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <Text strong style={{ fontSize: '18px' }}>应付总额:</Text>
              <Text strong style={{ fontSize: '18px', color: '#f5222d' }}>
                ¥{calculateTotalAmount(orderItems).toFixed(2)}
              </Text>
            </div>

            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              onClick={() => form.submit()}
            >
              提交订单
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default CheckoutPage
