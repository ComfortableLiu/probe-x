import React, { useState } from 'react'
import { Layout, Menu, Input, Button, Badge, Avatar, Dropdown } from 'antd'
import {
  SearchOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  HomeOutlined,
  AppstoreOutlined,
  HeartOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { trackButtonClick, trackSearch } from '../utils/probeX'
import { SPM_BUSINESS } from '../utils/trackingPoints'

const { Header: AntHeader } = Layout
const { Search } = Input

const Header: React.FC = () => {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')

  const handleSearch = (value: string) => {
    if (value.trim()) {
      // 头部为全局组件，树上无对应点位，给到业务线层级
      trackSearch(value, 0, { page: 'header', $spm: SPM_BUSINESS })
      navigate(`/search?keyword=${encodeURIComponent(value)}`)
    }
  }

  const handleMenuClick = (key: string) => {
    trackButtonClick('navigation', 'header', { menu_item: key, $spm: SPM_BUSINESS })
    navigate(`/${key}`)
  }

  const handleCartClick = () => {
    trackButtonClick('cart', 'header', { $spm: SPM_BUSINESS })
    navigate('/cart')
  }

  const handleProfileClick = () => {
    trackButtonClick('profile', 'header', { $spm: SPM_BUSINESS })
    navigate('/profile')
  }

  const menuItems = [
    {
      key: '',
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: 'products',
      icon: <AppstoreOutlined />,
      label: '商品',
    },
  ]

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'orders',
      icon: <AppstoreOutlined />,
      label: '我的订单',
    },
    {
      key: 'favorites',
      icon: <HeartOutlined />,
      label: '我的收藏',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: '退出登录',
    },
  ]

  return (
    <AntHeader style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      {/* Logo */}
      <div
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1890ff',
          cursor: 'pointer',
        }}
        onClick={() => {
          trackButtonClick('logo', 'header', { $spm: SPM_BUSINESS })
          navigate('/')
        }}
      >
        🛒 电商Demo
      </div>

      {/* 导航菜单 */}
      <Menu
        mode="horizontal"
        selectedKeys={[]}
        items={menuItems}
        onClick={({ key }) => handleMenuClick(key)}
        style={{
          flex: 1,
          justifyContent: 'center',
          border: 'none',
          background: 'transparent',
        }}
      />

      {/* 搜索框 */}
      <div style={{ width: '300px', margin: '0 24px' }}>
        <Search
          placeholder="搜索商品..."
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onSearch={handleSearch}
        />
      </div>

      {/* 右侧操作区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* 通知 */}
        <Button
          type="text"
          icon={<BellOutlined />}
          size="large"
          onClick={() => trackButtonClick('notification', 'header', { $spm: SPM_BUSINESS })}
        />

        {/* 购物车 */}
        <Badge count={3} size="small">
          <Button
            type="text"
            icon={<ShoppingCartOutlined />}
            size="large"
            onClick={handleCartClick}
          />
        </Badge>

        {/* 用户头像 */}
        <Dropdown
          menu={{
            items: userMenuItems,
            onClick: ({ key }) => {
              if (key === 'logout') {
                trackButtonClick('logout', 'header', { $spm: SPM_BUSINESS })
                // 处理退出登录
              } else {
                handleMenuClick(key)
              }
            },
          }}
          placement="bottomRight"
        >
          <Avatar
            size="large"
            icon={<UserOutlined />}
            style={{ cursor: 'pointer' }}
            onClick={handleProfileClick}
          />
        </Dropdown>
      </div>
    </AntHeader>
  )
}

export default Header
