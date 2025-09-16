import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, InputNumber, Tag, Space, Rate, Tabs, Image } from 'antd';
import { ShoppingCartOutlined, HeartOutlined } from '@ant-design/icons';
import { mockProducts } from '../data/mockData';
import { trackPageView, trackProductView, trackAddToCart, trackButtonClick } from '../utils/probeX';

const { TabPane } = Tabs;

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (id) {
      const foundProduct = mockProducts.find(p => p.id === id);
      if (foundProduct) {
        setProduct(foundProduct);
        trackPageView('product_detail', {
          product_id: id,
          product_name: foundProduct.name,
          product_price: foundProduct.price
        });
        trackProductView(foundProduct, { source: 'product_detail' });
      } else {
        navigate('/products');
      }
    }
  }, [id, navigate]);

  const handleAddToCart = () => {
    if (product) {
      trackAddToCart(product, quantity, { source: 'product_detail' });
      // 这里可以添加到购物车的逻辑
    }
  };

  const handleBuyNow = () => {
    if (product) {
      trackButtonClick('buy_now', 'product_detail', {
        product_id: product.id,
        quantity: quantity
      });
      // 这里可以跳转到结算页面
    }
  };

  const handleImageChange = (index: number) => {
    setSelectedImageIndex(index);
    trackButtonClick('product_image_change', 'product_detail', {
      product_id: product?.id,
      image_index: index
    });
  };

  if (!product) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[24, 24]}>
        {/* 商品图片 */}
        <Col xs={24} md={12}>
          <div style={{ textAlign: 'center' }}>
            <Image
              src={product.images?.[selectedImageIndex] || product.image}
              alt={product.name}
              style={{ maxWidth: '100%', height: '400px', objectFit: 'cover' }}
            />
            {product.images && product.images.length > 1 && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                {product.images.map((image: string, index: number) => (
                  <img
                    key={index}
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    style={{
                      width: '80px',
                      height: '80px',
                      objectFit: 'cover',
                      cursor: 'pointer',
                      border: selectedImageIndex === index ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      borderRadius: '4px'
                    }}
                    onClick={() => handleImageChange(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </Col>

        {/* 商品信息 */}
        <Col xs={24} md={12}>
          <Card>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>{product.name}</h1>
            
            <div style={{ marginBottom: '16px' }}>
              <Rate disabled defaultValue={product.rating} style={{ fontSize: '16px' }} />
              <span style={{ marginLeft: '8px', color: '#666' }}>
                {product.rating} ({product.reviewCount} 条评价)
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Space wrap>
                <Tag color="blue">{product.brand}</Tag>
                <Tag color="green">{product.category}</Tag>
                {product.tags?.map((tag: string) => (
                  <Tag key={tag} color="orange">{tag}</Tag>
                ))}
              </Space>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '32px', color: '#f5222d', fontWeight: 'bold' }}>
                ¥{product.price}
              </div>
              {product.originalPrice && product.originalPrice > product.price && (
                <div style={{ color: '#999', textDecoration: 'line-through' }}>
                  原价: ¥{product.originalPrice}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: '#666', lineHeight: '1.6' }}>{product.description}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <span style={{ marginRight: '16px' }}>数量:</span>
              <InputNumber
                min={1}
                max={product.stock}
                value={quantity}
                onChange={(value) => setQuantity(value || 1)}
                style={{ width: '100px' }}
              />
              <span style={{ marginLeft: '8px', color: '#666' }}>
                库存: {product.stock} 件
              </span>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                onClick={handleAddToCart}
                style={{ flex: 1 }}
              >
                加入购物车
              </Button>
              <Button
                size="large"
                icon={<HeartOutlined />}
                style={{ flex: 1 }}
              >
                收藏
              </Button>
            </div>

            <div style={{ marginTop: '16px' }}>
              <Button
                type="primary"
                size="large"
                onClick={handleBuyNow}
                style={{ width: '100%' }}
              >
                立即购买
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 商品详情 */}
      <Row style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card>
            <Tabs defaultActiveKey="1">
              <TabPane tab="商品详情" key="1">
                <div style={{ padding: '16px' }}>
                  <h3>商品规格</h3>
                  <Row gutter={[16, 16]}>
                    {Object.entries(product.specifications || {}).map(([key, value]) => (
                      <Col xs={24} sm={12} md={8} key={key}>
                        <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                          <strong>{key}: </strong>
                          <span>{value as string}</span>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              </TabPane>
              <TabPane tab="用户评价" key="2">
                <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                  暂无用户评价
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductDetailPage;
