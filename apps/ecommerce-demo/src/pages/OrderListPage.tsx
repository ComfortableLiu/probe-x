import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tabs, Tag, Button, Typography, List, Empty } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { mockOrders, OrderStatus } from '../data/mockData'
import { trackPageView, trackButtonClick } from '../utils/probeX'

const { Title, Text } = Typography
const { TabPane } = Tabs

const OrderListPage: React.FC = () => {
  const navigate = useNavigate()
  const [orders, setOrders] = useState(mockOrders)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    trackPageView('order_list', {
      page_title: '我的订单',
      orders_count: orders.length,
    })
  }, [orders.length, activeTab])

  const getStatusColor = (status: OrderStatus) => {
    const statusColors = {
      [OrderStatus.PENDING]: 'orange',
      [OrderStatus.PAID]: 'blue',
      [OrderStatus.SHIPPED]: 'purple',
      [OrderStatus.DELIVERED]: 'green',
      [OrderStatus.CANCELLED]: 'red',
      [OrderStatus.REFUNDED]: 'gray',
    }
    return statusColors[status] || 'default'
  }

  const getStatusText = (status: OrderStatus) => {
    const statusTexts = {
      [OrderStatus.PENDING]: '待支付',
      [OrderStatus.PAID]: '已支付',
      [OrderStatus.SHIPPED]: '已发货',
      [OrderStatus.DELIVERED]: '已送达',
      [OrderStatus.CANCELLED]: '已取消',
      [OrderStatus.REFUNDED]: '已退款',
    }
    return statusTexts[status] || '未知状态'
  }

  const handleViewOrder = (order: any) => {
    trackButtonClick('view_order', 'order_list', {
      order_id: order.id,
      order_status: order.status,
    })
    navigate(`/orders/${order.id}`)
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    trackButtonClick('order_tab_change', 'order_list', {
      tab: key,
    })
  }

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true
    return order.status === activeTab
  })

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>我的订单</Title>

      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane tab="全部订单" key="all" />
        <TabPane tab="待支付" key={OrderStatus.PENDING} />
        <TabPane tab="已支付" key={OrderStatus.PAID} />
        <TabPane tab="已发货" key={OrderStatus.SHIPPED} />
        <TabPane tab="已送达" key={OrderStatus.DELIVERED} />
      </Tabs>

      {filteredOrders.length > 0 ? (
        <div style={{ marginTop: '24px' }}>
          {filteredOrders.map((order) => (
            <Card key={order.id} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <Text strong>订单号: {order.orderNumber}</Text>
                  <br />
                  <Text type="secondary">下单时间: {new Date(order.createdAt).toLocaleString()}</Text>
                </div>
                <div>
                  <Tag color={getStatusColor(order.status)}>
                    {getStatusText(order.status)}
                  </Tag>
                </div>
              </div>

              <List
                dataSource={order.items}
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
                      <Text strong>¥{item.totalPrice.toFixed(2)}</Text>
                    </div>
                  </List.Item>
                )}
              />

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #f0f0f0',
              }}>
                <div>
                  <Text strong>商品清单:</Text>
                  <div style={{ marginTop: '8px' }}>
                    {order.items.map((item: any, index: number) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}>
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          style={{ width: '30px', height: '30px', objectFit: 'cover' }}
                        />
                        <Text style={{ fontSize: '12px' }}>
                          {item.product.name} x{item.quantity}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>
                    <Text strong style={{ fontSize: '18px', color: '#f5222d' }}>
                      实付: ¥{order.finalAmount.toFixed(2)}
                    </Text>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <Button
                      type="primary"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewOrder(order)}
                    >
                      查看详情
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          description="暂无订单"
          style={{ marginTop: '60px' }}
        >
          <Button type="primary" onClick={() => navigate('/products')}>
            去购物
          </Button>
        </Empty>
      )}
    </div>
  )
}

export default OrderListPage
