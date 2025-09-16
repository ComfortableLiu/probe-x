import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Card, Tag, Timeline, List, Typography, Button, Row, Col } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { mockOrders, OrderStatus } from '../data/mockData';
import { trackPageView, trackButtonClick } from '../utils/probeX';

const { Title, Text } = Typography;

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (id) {
      const foundOrder = mockOrders.find(o => o.id === id);
      if (foundOrder) {
        setOrder(foundOrder);
        trackPageView('order_detail', {
          order_id: id,
          order_status: foundOrder.status
        });
      } else if (location.state?.order) {
        setOrder(location.state.order);
        trackPageView('order_detail', {
          order_id: id,
          order_status: location.state.order.status
        });
      } else {
        navigate('/orders');
      }
    }
  }, [id, location.state]);

  const getStatusColor = (status: OrderStatus) => {
    const statusColors = {
      [OrderStatus.PENDING]: 'orange',
      [OrderStatus.PAID]: 'blue',
      [OrderStatus.SHIPPED]: 'purple',
      [OrderStatus.DELIVERED]: 'green',
      [OrderStatus.CANCELLED]: 'red',
      [OrderStatus.REFUNDED]: 'gray',
    };
    return statusColors[status] || 'default';
  };

  const getStatusText = (status: OrderStatus) => {
    const statusTexts = {
      [OrderStatus.PENDING]: '待支付',
      [OrderStatus.PAID]: '已支付',
      [OrderStatus.SHIPPED]: '已发货',
      [OrderStatus.DELIVERED]: '已送达',
      [OrderStatus.CANCELLED]: '已取消',
      [OrderStatus.REFUNDED]: '已退款',
    };
    return statusTexts[status] || '未知状态';
  };

  const getTimelineItems = (order: any) => {
    const items = [
      {
        color: 'green',
        children: (
          <div>
            <Text strong>订单创建</Text>
            <br />
            <Text type="secondary">{new Date(order.createdAt).toLocaleString()}</Text>
          </div>
        ),
      },
    ];

    if (order.status !== OrderStatus.PENDING) {
      items.push({
        color: 'blue',
        children: (
          <div>
            <Text strong>支付完成</Text>
            <br />
            <Text type="secondary">{new Date(order.updatedAt).toLocaleString()}</Text>
          </div>
        ),
      });
    }

    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      items.push({
        color: 'purple',
        children: (
          <div>
            <Text strong>商品已发货</Text>
            <br />
            <Text type="secondary">预计3-5天送达</Text>
          </div>
        ),
      });
    }

    if (order.status === OrderStatus.DELIVERED) {
      items.push({
        color: 'green',
        children: (
          <div>
            <Text strong>订单完成</Text>
            <br />
            <Text type="secondary">感谢您的购买</Text>
          </div>
        ),
      });
    }

    return items;
  };

  if (!order) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/orders')}
        >
          返回订单列表
        </Button>
      </div>

      <Title level={2}>订单详情</Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          {/* 订单信息 */}
          <Card title="订单信息" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <Text strong>订单号: {order.orderNumber}</Text>
                <br />
                <Text type="secondary">下单时间: {new Date(order.createdAt).toLocaleString()}</Text>
              </div>
              <Tag color={getStatusColor(order.status)} style={{ fontSize: '14px' }}>
                {getStatusText(order.status)}
              </Tag>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Text strong>收货地址:</Text>
              <br />
              <Text>
                {order.shippingAddress.name} {order.shippingAddress.phone}
                <br />
                {order.shippingAddress.province} {order.shippingAddress.city} {order.shippingAddress.district} {order.shippingAddress.address}
              </Text>
            </div>

            <div>
              <Text strong>支付方式: {order.paymentMethod}</Text>
            </div>
          </Card>

          {/* 商品清单 */}
          <Card title="商品清单" style={{ marginBottom: '24px' }}>
            <List
              dataSource={order.items}
              renderItem={(item: any) => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <Title level={5} style={{ margin: 0 }}>{item.product.name}</Title>
                      <Text type="secondary">{item.product.description}</Text>
                      <br />
                      <Text>数量: {item.quantity}</Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text strong style={{ fontSize: '16px' }}>
                        ¥{item.totalPrice.toFixed(2)}
                      </Text>
                      <br />
                      <Text type="secondary">
                        ¥{item.price.toFixed(2)} × {item.quantity}
                      </Text>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* 订单状态 */}
          <Card title="订单状态" style={{ marginBottom: '24px' }}>
            <Timeline items={getTimelineItems(order)} />
          </Card>

          {/* 费用明细 */}
          <Card title="费用明细">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Text>商品总价:</Text>
              <Text>¥{order.totalAmount.toFixed(2)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Text>优惠金额:</Text>
              <Text style={{ color: '#52c41a' }}>-¥{order.discountAmount.toFixed(2)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Text>运费:</Text>
              <Text>¥{order.shippingFee.toFixed(2)}</Text>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              paddingTop: '8px',
              borderTop: '1px solid #f0f0f0'
            }}>
              <Text strong style={{ fontSize: '16px' }}>实付金额:</Text>
              <Text strong style={{ fontSize: '16px', color: '#f5222d' }}>
                ¥{order.finalAmount.toFixed(2)}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OrderDetailPage;
