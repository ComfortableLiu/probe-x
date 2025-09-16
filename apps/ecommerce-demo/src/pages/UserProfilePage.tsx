import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Button, Typography, List, Tag, Avatar } from 'antd';
import { EditOutlined, HomeOutlined, ShoppingCartOutlined, HeartOutlined, StarOutlined } from '@ant-design/icons';
import { mockUser } from '../data/mockData';
import { trackPageView, trackButtonClick } from '../utils/probeX';

const { Title, Text } = Typography;

const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState(mockUser);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    trackPageView('user_profile', {
      page_title: '个人中心',
      user_id: user.id
    });
  }, [user.id]);

  const handleEditProfile = () => {
    setEditing(true);
    trackButtonClick('edit_profile', 'user_profile');
  };

  const handleSaveProfile = (values: any) => {
    console.log('保存用户资料:', values);
    setEditing(false);
    trackButtonClick('save_profile', 'user_profile');
  };

  const handleCancelEdit = () => {
    setEditing(false);
    trackButtonClick('cancel_edit', 'user_profile');
  };

  const handleEditAddress = (addressId: string) => {
    trackButtonClick('edit_address', 'user_profile', { addressId });
    // 这里可以打开编辑地址的模态框
  };

  const handleDeleteAddress = (addressId: string) => {
    trackButtonClick('delete_address', 'user_profile', { addressId });
    // 这里可以删除地址
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>个人中心</Title>

      <Row gutter={[24, 24]}>
        {/* 用户信息 */}
        <Col xs={24} lg={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Avatar size={80} src={user.avatar} style={{ marginBottom: '16px' }} />
              <Title level={4}>{user.username}</Title>
              <Text type="secondary">{user.email}</Text>
              <br />
              <Text type="secondary">{user.phone}</Text>
            </div>
            
            <div style={{ marginTop: '24px' }}>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={handleEditProfile}
                block
              >
                编辑资料
              </Button>
            </div>
          </Card>
        </Col>

        {/* 用户统计 */}
        <Col xs={24} lg={16}>
          <Card title="我的统计">
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', color: '#1890ff' }}>
                    <ShoppingCartOutlined />
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '8px' }}>5</div>
                  <div style={{ color: '#666' }}>订单数量</div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', color: '#52c41a' }}>
                    <HomeOutlined />
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '8px' }}>¥2,580</div>
                  <div style={{ color: '#666' }}>消费金额</div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', color: '#faad14' }}>
                    <HeartOutlined />
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '8px' }}>12</div>
                  <div style={{ color: '#666' }}>收藏商品</div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', color: '#f5222d' }}>
                    <StarOutlined />
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '8px' }}>8</div>
                  <div style={{ color: '#666' }}>评价数量</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 收货地址 */}
      <Row style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card title="收货地址">
            <List
              dataSource={user.address}
              renderItem={(address) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => handleEditAddress(address.id)}
                    >
                      编辑
                    </Button>,
                    <Button
                      type="link"
                      danger
                      onClick={() => handleDeleteAddress(address.id)}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{address.name}</span>
                        <span>{address.phone}</span>
                        {address.isDefault && <Tag color="blue">默认</Tag>}
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ color: '#666', marginTop: '4px' }}>
                          {address.province} {address.city} {address.district} {address.address}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 编辑表单 */}
      {editing && (
        <Row style={{ marginTop: '24px' }}>
          <Col span={24}>
            <Card title="编辑资料">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const values = {
                  username: formData.get('username'),
                  email: formData.get('email'),
                  phone: formData.get('phone'),
                };
                handleSaveProfile(values);
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <label>用户名:</label>
                  <input
                    type="text"
                    name="username"
                    defaultValue={user.username}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label>邮箱:</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={user.email}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label>手机号:</label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={user.phone}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button type="primary" htmlType="submit">
                    保存
                  </Button>
                  <Button onClick={handleCancelEdit}>
                    取消
                  </Button>
                </div>
              </form>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default UserProfilePage;
