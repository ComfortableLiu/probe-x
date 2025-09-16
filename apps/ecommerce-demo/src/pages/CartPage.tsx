import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, InputNumber, Checkbox, Modal, Typography, Empty } from 'antd';
import { DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { mockProducts } from '../data/mockData';
import { trackPageView, trackCartAction, trackButtonClick } from '../utils/probeX';

const { Title, Text } = Typography;

interface CartItem {
  id: string;
  product: any;
  quantity: number;
  selected: boolean;
}

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 模拟购物车数据
    const mockCartItems: CartItem[] = [
      {
        id: '1',
        product: mockProducts[0],
        quantity: 1,
        selected: true
      },
      {
        id: '2',
        product: mockProducts[1],
        quantity: 2,
        selected: true
      }
    ];
    setCartItems(mockCartItems);
    
    trackPageView('cart', {
      page_title: '购物车',
      cart_items_count: mockCartItems.length
    });
  }, []);

  const calculateTotalValue = (items: CartItem[]) => {
    return items
      .filter(item => item.selected)
      .reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const calculateTotalQuantity = (items: CartItem[]) => {
    return items
      .filter(item => item.selected)
      .reduce((total, item) => total + item.quantity, 0);
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setCartItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
    
    trackCartAction('quantity_change', cartItems.find(item => item.id === itemId)?.product, newQuantity);
  };

  const handleItemSelect = (itemId: string, selected: boolean) => {
    setCartItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, selected }
        : item
    ));
    
    trackCartAction('item_select', cartItems.find(item => item.id === itemId)?.product, undefined, { selected });
  };

  const handleSelectAll = (checked: boolean) => {
    setCartItems(prev => prev.map(item => ({ ...item, selected: checked })));
    setSelectAll(checked);
    
    trackButtonClick('select_all', 'cart', { checked });
  };

  const handleRemoveItem = (itemId: string) => {
    const item = cartItems.find(item => item.id === itemId);
    
    Modal.confirm({
      title: '确认删除',
      content: '确定要从购物车中删除这个商品吗？',
      onOk: () => {
        setCartItems(prev => prev.filter(item => item.id !== itemId));
        trackCartAction('remove_item', item?.product);
      }
    });
  };

  const handleCheckout = () => {
    const selectedItems = cartItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      Modal.warning({
        title: '提示',
        content: '请选择要结算的商品'
      });
      return;
    }
    
    trackButtonClick('checkout', 'cart', {
      selected_items_count: selectedItems.length,
      total_amount: calculateTotalValue(selectedItems)
    });
    
    navigate('/checkout', { state: { items: selectedItems } });
  };

  if (cartItems.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Empty
          image={<ShoppingCartOutlined style={{ fontSize: '64px', color: '#d9d9d9' }} />}
          description="购物车是空的"
        >
          <Button type="primary" onClick={() => navigate('/products')}>
            去购物
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>购物车</Title>
      
      <Card>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
          <Checkbox
            checked={selectAll}
            onChange={(e) => handleSelectAll(e.target.checked)}
          >
            全选
          </Checkbox>
        </div>

        {cartItems.map((item) => (
          <Card
            key={item.id}
            style={{ marginBottom: '16px' }}
            bodyStyle={{ padding: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Checkbox
                checked={item.selected}
                onChange={(e) => handleItemSelect(item.id, e.target.checked)}
              />
              
              <img
                src={item.product.image}
                alt={item.product.name}
                style={{ width: '80px', height: '80px', objectFit: 'cover' }}
              />
              
              <div style={{ flex: 1 }}>
                <Title level={5} style={{ margin: 0 }}>{item.product.name}</Title>
                <Text type="secondary">{item.product.description}</Text>
              </div>
              
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <Text strong style={{ color: '#f5222d', fontSize: '18px' }}>
                  ¥{item.product.price}
                </Text>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <InputNumber
                  min={1}
                  max={item.product.stock}
                  value={item.quantity}
                  onChange={(value) => handleQuantityChange(item.id, value || 1)}
                  style={{ width: '80px' }}
                />
              </div>
              
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <Text strong style={{ fontSize: '16px' }}>
                  ¥{(item.product.price * item.quantity).toFixed(2)}
                </Text>
              </div>
              
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveItem(item.id)}
              />
            </div>
          </Card>
        ))}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '16px',
          background: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <div>
            <Text>已选择 {calculateTotalQuantity(cartItems)} 件商品</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <Text>合计: </Text>
              <Text strong style={{ color: '#f5222d', fontSize: '20px' }}>
                ¥{calculateTotalValue(cartItems).toFixed(2)}
              </Text>
            </div>
            <Button
              type="primary"
              size="large"
              onClick={handleCheckout}
              loading={loading}
            >
              结算
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CartPage;
