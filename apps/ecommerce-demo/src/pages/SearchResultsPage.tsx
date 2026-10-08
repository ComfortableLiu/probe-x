import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Row, Col, Card, Input, Select, Button, Pagination, Spin, Empty, Tag, Space, Rate, Typography, Breadcrumb } from 'antd'
import { SearchOutlined, FilterOutlined, EyeOutlined, HeartOutlined, HeartFilled, ShoppingCartOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons'
import { mockProducts, mockCategories } from '../data/mockData'
import { trackPageView, trackSearch, trackProductClick, trackAddToCart, trackButtonClick, trackProductExposure } from '../utils/probeX'
import { SPM_PAGE_PATH, SPM_POINT, SCM_POINT, buildProductScm } from '../utils/trackingPoints'
import { useFavorites } from '../hooks/useFavorites'

const { Search } = Input
const { Option } = Select
const { Title, Text } = Typography

const SearchResultsPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // 状态管理
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get('keyword') || '')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [sortBy, setSortBy] = useState('default')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const { favorites, toggleFavorite } = useFavorites('search_results', SPM_POINT.SEARCH_FAVORITE)

  // 结果列表容器 ref 与已曝光商品记录（同一商品同一次页面浏览只上报一次曝光）
  const listRef = useRef<HTMLDivElement>(null)
  const exposedRef = useRef(new Set<string>())

  // 获取所有品牌
  const brands = Array.from(new Set(mockProducts.map(product => product.brand)))

  // 过滤和排序商品
  const filteredProducts = React.useMemo(() => {
    let filtered = mockProducts

    // 关键词搜索
    if (searchKeyword) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        product.description.toLowerCase().includes(searchKeyword.toLowerCase()),
      )
    }

    // 分类筛选
    if (selectedCategory) {
      filtered = filtered.filter(product => product.category === selectedCategory)
    }

    // 品牌筛选
    if (selectedBrand) {
      filtered = filtered.filter(product => product.brand === selectedBrand)
    }

    // 排序
    if (sortBy !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        let aValue, bValue

        switch (sortBy) {
          case 'price':
            aValue = a.price
            bValue = b.price
            break
          case 'rating':
            aValue = a.rating
            bValue = b.rating
            break
          case 'sales':
            aValue = a.sales
            bValue = b.sales
            break
          case 'createdAt':
            aValue = new Date(a.createdAt).getTime()
            bValue = new Date(b.createdAt).getTime()
            break
          default:
            return 0
        }

        if (sortOrder === 'asc') {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }

    return filtered
  }, [searchKeyword, selectedCategory, selectedBrand, sortBy, sortOrder])

  // 分页
  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  useEffect(() => {
    trackPageView('search_results', {
      page_title: '搜索结果',
      search_keyword: searchKeyword,
      results_count: filteredProducts.length,
      current_page: currentPage,
    }, { spm: SPM_PAGE_PATH.SEARCH_RESULTS, scm: SCM_POINT.SEARCH_RESULTS })
  }, [searchKeyword, filteredProducts.length, currentPage])

  // 商品曝光埋点：卡片 50% 以上进入视口时上报，翻页/筛选后重新观察
  useEffect(() => {
    const container = listRef.current
    if (!container || currentProducts.length === 0) return

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        const el = entry.target as HTMLElement
        const productId = el.dataset.productId
        if (!productId || exposedRef.current.has(productId)) return

        const product = currentProducts.find(p => p.id === productId)
        if (product) {
          exposedRef.current.add(productId)
          trackProductExposure({
            page: 'search_results',
            position: Number(el.dataset.productIndex) + 1,
            $spm: SPM_POINT.SEARCH_PRODUCT_EXPOSURE,
            $scm: buildProductScm(product.id),
          })
        }
        observer.unobserve(el)
      })
    }, { threshold: 0.5 })

    container.querySelectorAll('[data-product-id]').forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [currentProducts])

  const handleSearch = (value: string) => {
    setSearchKeyword(value)
    trackSearch(value, filteredProducts.length, {
      page: 'search_results',
      // 树上无搜索点位，给到页面层级
      $spm: SPM_PAGE_PATH.SEARCH_RESULTS,
    })
  }

  const handleProductClick = (product: any) => {
    trackProductClick('search_results_card', {
      $spm: SPM_POINT.SEARCH_PRODUCT_CLICK,
      $scm: buildProductScm(product.id),
    })
    navigate(`/products/${product.id}`)
  }

  const handleAddToCart = (product: any, e: React.MouseEvent) => {
    e.stopPropagation()
    trackAddToCart(product, 1, {
      source: 'search_results',
      $spm: SPM_POINT.SEARCH_QUICK_ADD_TO_CART,
      $scm: buildProductScm(product.id),
    })
  }

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
    // 树上搜索结果页无筛选器模块，给到页面层级
    trackButtonClick('category_filter', 'search_results', {
      category: value,
      $spm: SPM_PAGE_PATH.SEARCH_RESULTS,
    })
  }

  const handleBrandChange = (value: string) => {
    setSelectedBrand(value)
    trackButtonClick('brand_filter', 'search_results', {
      brand: value,
      $spm: SPM_PAGE_PATH.SEARCH_RESULTS,
    })
  }

  const handleSortChange = (value: string) => {
    setSortBy(value)
    trackButtonClick('sort_change', 'search_results', {
      sort_by: value,
      sort_order: sortOrder,
      $spm: SPM_PAGE_PATH.SEARCH_RESULTS,
    })
  }

  const handleSortOrderChange = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    setSortOrder(newOrder)
    trackButtonClick('sort_order_change', 'search_results', {
      sort_by: sortBy,
      sort_order: newOrder,
      $spm: SPM_PAGE_PATH.SEARCH_RESULTS,
    })
  }

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page)
    setPageSize(size)
    trackButtonClick('pagination', 'search_results', {
      page: page,
      page_size: size,
      total_products: filteredProducts.length,
      $spm: SPM_PAGE_PATH.SEARCH_RESULTS,
    })
  }

  const breadcrumbItems = [
    { title: '首页', href: '/' },
    { title: '搜索结果' },
  ]

  return (
    <div style={{ padding: '24px' }}>
      {/* 面包屑导航 */}
      <Breadcrumb items={breadcrumbItems} style={{ marginBottom: '24px' }} />

      <Title level={2} style={{ marginBottom: '24px' }}>
        搜索结果
        {searchKeyword && (
          <Text type="secondary" style={{ fontSize: '16px', marginLeft: '12px' }}>
            关键词: &quot;{searchKeyword}&quot;
          </Text>
        )}
      </Title>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索商品..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={handleSearch}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="选择分类"
              style={{ width: '100%' }}
              size="large"
              value={selectedCategory}
              onChange={handleCategoryChange}
              allowClear
            >
              {mockCategories.map(category => (
                <Option key={category.id} value={category.name}>
                  {category.icon} {category.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="选择品牌"
              style={{ width: '100%' }}
              size="large"
              value={selectedBrand}
              onChange={handleBrandChange}
              allowClear
            >
              {brands.map(brand => (
                <Option key={brand} value={brand}>
                  {brand}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="排序方式"
              style={{ width: '100%' }}
              size="large"
              value={sortBy}
              onChange={handleSortChange}
            >
              <Option value="default">默认排序</Option>
              <Option value="price">价格</Option>
              <Option value="rating">评分</Option>
              <Option value="sales">销量</Option>
              <Option value="createdAt">上架时间</Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Button
              size="large"
              icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
              onClick={handleSortOrderChange}
              style={{ width: '100%' }}
            >
              {sortOrder === 'asc' ? '升序' : '降序'}
            </Button>
          </Col>
        </Row>
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {searchKeyword && (
              <span style={{ marginRight: '8px' }}>
                关键词: <Tag color="blue">{searchKeyword}</Tag>
              </span>
            )}
            {selectedCategory && (
              <span style={{ marginRight: '8px' }}>
                分类: <Tag color="green">{selectedCategory}</Tag>
              </span>
            )}
            {selectedBrand && (
              <span style={{ marginRight: '8px' }}>
                品牌: <Tag color="orange">{selectedBrand}</Tag>
              </span>
            )}
          </div>
          <div>
            <Button
              icon={<FilterOutlined />}
              onClick={() => {
                setSearchKeyword('')
                setSelectedCategory('')
                setSelectedBrand('')
                setSortBy('default')
                setSortOrder('asc')
                trackButtonClick('clear_filters', 'search_results', { $spm: SPM_PAGE_PATH.SEARCH_RESULTS })
              }}
            >
              清除筛选
            </Button>
          </div>
        </div>
      </Card>

      {/* 搜索结果 */}
      {currentProducts.length > 0 ? (
        <>
          <div ref={listRef}>
            <Row gutter={[24, 24]}>
              {currentProducts.map((product, index) => (
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
                      favorites.has(product.id)
                        ? (
                          <HeartFilled
                            key="favorite"
                            style={{ color: '#f5222d' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavorite(product)
                            }}
                          />
                        )
                        : (
                          <HeartOutlined
                            key="favorite"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavorite(product)
                            }}
                          />
                        ),
                      <ShoppingCartOutlined
                        key="cart"
                        onClick={(e) => handleAddToCart(product, e)}
                      />,
                    ]}
                  >
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                        {product.name}
                      </div>
                      <div className="product-description" style={{
                        color: '#666',
                        fontSize: '14px',
                        marginBottom: '12px',
                        height: '40px',
                        overflow: 'hidden',
                      }}>
                        {product.description}
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <Rate disabled defaultValue={product.rating} style={{ fontSize: '14px' }} />
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#999' }}>
                        ({product.reviewCount})
                        </span>
                      </div>
                      <Space wrap>
                        <Tag color="blue">{product.brand}</Tag>
                        <Tag color="green">{product.category}</Tag>
                        {product.stock < 10 && (
                          <Tag color="red">库存紧张</Tag>
                        )}
                      </Space>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: '#f5222d', fontSize: '18px', fontWeight: 'bold' }}>
                        ¥{product.price}
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span style={{ color: '#999', marginLeft: '8px', textDecoration: 'line-through' }}>
                          ¥{product.originalPrice}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                      已售 {product.sales}
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          {/* 分页 */}
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredProducts.length}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
              onChange={handlePageChange}
              onShowSizeChange={handlePageChange}
            />
          </div>
        </>
      ) : (
        <Empty
          description="没有找到相关商品"
          style={{ padding: '60px 0' }}
        >
          <Button type="primary" onClick={() => {
            setSearchKeyword('')
            setSelectedCategory('')
            setSelectedBrand('')
            setSortBy('default')
            setSortOrder('asc')
          }}>
            查看所有商品
          </Button>
        </Empty>
      )}
    </div>
  )
}

export default SearchResultsPage
