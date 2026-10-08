import React, { useEffect, useRef } from 'react'
import { Row, Col, Card, Button, Typography, Carousel } from 'antd'
import { ShoppingCartOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { mockProducts, mockCategories } from '../data/mockData'
import { trackPageView, trackProductClick, trackAddToCart, trackButtonClick, trackProductExposure } from '../utils/probeX'
import { SPM_PAGE_PATH, SPM_POINT, SCM_POINT, buildProductScm, buildCategoryScm, buildBannerScm } from '../utils/trackingPoints'

const { Title, Text } = Typography

const HomePage: React.FC = () => {
  const navigate = useNavigate()

  // 精选商品容器 ref 与已曝光商品记录（同一商品同一次页面浏览只上报一次曝光）
  const featuredRef = useRef<HTMLDivElement>(null)
  const exposedRef = useRef(new Set<string>())

  useEffect(() => {
    trackPageView('home', {
      page_title: '首页',
      featured_products_count: mockProducts.slice(0, 6).length,
      categories_count: mockCategories.length,
    }, { spm: SPM_PAGE_PATH.HOME, scm: SCM_POINT.DIRECT_HOME })
  }, [])

  // 精选商品曝光埋点：卡片 50% 以上进入视口时上报
  useEffect(() => {
    const container = featuredRef.current
    if (!container) return

    const featuredProducts = mockProducts.slice(0, 6)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        const el = entry.target as HTMLElement
        const productId = el.dataset.productId
        if (!productId || exposedRef.current.has(productId)) return

        const product = featuredProducts.find(p => p.id === productId)
        if (product) {
          exposedRef.current.add(productId)
          trackProductExposure({
            page: 'home',
            position: Number(el.dataset.productIndex) + 1,
            $spm: SPM_POINT.HOME_PRODUCT_EXPOSURE,
            $scm: buildProductScm(product.id),
          })
        }
        observer.unobserve(el)
      })
    }, { threshold: 0.5 })

    container.querySelectorAll('[data-product-id]').forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  const handleProductClick = (product: any) => {
    trackProductClick('home_featured', {
      $spm: SPM_POINT.HOME_PRODUCT_CLICK,
      $scm: buildProductScm(product.id),
    })
    navigate(`/products/${product.id}`)
  }

  const handleAddToCart = (product: any, e: React.MouseEvent) => {
    e.stopPropagation()
    trackAddToCart(product, 1, {
      source: 'home_featured',
      $spm: SPM_POINT.HOME_ADD_TO_CART,
      $scm: buildProductScm(product.id),
    })
    // 这里可以添加到购物车的逻辑
  }

  const handleCategoryClick = (category: any) => {
    trackButtonClick('category_click', 'home', {
      category_id: category.id,
      category_name: category.name,
      $spm: SPM_POINT.HOME_CATEGORY_CLICK,
      $scm: buildCategoryScm(category.name),
    })
    navigate(`/products?category=${category.id}`)
  }

  const handleBannerClick = (image: string, index: number) => {
    trackButtonClick('banner_click', 'home', {
      banner_index: index + 1,
      banner_image: image,
      $spm: SPM_POINT.HOME_BANNER_CLICK,
      $scm: buildBannerScm(index),
    })
  }

  const bannerImages = [
    'https://via.placeholder.com/1200x400?text=Banner+1',
    'https://via.placeholder.com/1200x400?text=Banner+2',
    'https://via.placeholder.com/1200x400?text=Banner+3',
  ]

  return (
    <div style={{ padding: '24px' }}>
      {/* 轮播图 */}
      <div style={{ marginBottom: '32px' }}>
        <Carousel autoplay>
          {bannerImages.map((image, index) => (
            <div key={index}>
              <div
                onClick={() => handleBannerClick(image, index)}
                style={{
                  height: '400px',
                  backgroundImage: `url(${image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '48px',
                  fontWeight: 'bold',
                }}
              >
                Banner {index + 1}
              </div>
            </div>
          ))}
        </Carousel>
      </div>

      {/* 分类导航 */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>
          商品分类
        </Title>
        <Row gutter={[16, 16]}>
          {mockCategories.map((category) => (
            <Col xs={12} sm={8} md={6} lg={4} key={category.id}>
              <Card
                hoverable
                style={{ textAlign: 'center', height: '120px' }}
                bodyStyle={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  height: '100%',
                }}
                onClick={() => handleCategoryClick(category)}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                  {category.icon}
                </div>
                <Text strong>{category.name}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 精选商品 */}
      <div ref={featuredRef}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>
          精选商品
        </Title>
        <Row gutter={[24, 24]}>
          {mockProducts.slice(0, 6).map((product, index) => (
            <Col
              xs={24}
              sm={12}
              md={8}
              lg={6}
              key={product.id}
              data-product-id={product.id}
              data-product-index={index}
            >
              <Card
                hoverable
                className="product-card"
                cover={
                  <div
                    style={{
                      height: '200px',
                      backgroundImage: `url(${product.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleProductClick(product)}
                  />
                }
                actions={[
                  <EyeOutlined
                    key="view"
                    onClick={() => handleProductClick(product)}
                  />,
                  <ShoppingCartOutlined
                    key="cart"
                    onClick={(e) => handleAddToCart(product, e)}
                  />,
                ]}
              >
                <div>
                  <Title level={5} style={{ marginBottom: '8px' }}>
                    {product.name}
                  </Title>
                  <div className="product-description" style={{
                    color: '#666',
                    fontSize: '14px',
                    marginBottom: '12px',
                    height: '40px',
                    overflow: 'hidden',
                  }}>
                    {product.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text strong style={{ color: '#f5222d', fontSize: '18px' }}>
                        ¥{product.price}
                      </Text>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <Text delete style={{ color: '#999', marginLeft: '8px' }}>
                          ¥{product.originalPrice}
                        </Text>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      已售 {product.sales}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 查看更多按钮 */}
      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <Button
          type="primary"
          size="large"
          onClick={() => navigate('/products')}
        >
          查看更多商品
        </Button>
      </div>
    </div>
  )
}

export default HomePage
