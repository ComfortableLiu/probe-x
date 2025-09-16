import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Layout } from 'antd';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ProductListPage from './pages/ProductListPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderListPage from './pages/OrderListPage';
import OrderDetailPage from './pages/OrderDetailPage';
import UserProfilePage from './pages/UserProfilePage';
import SearchResultsPage from './pages/SearchResultsPage';
import { initProbeX } from './utils/probeX';

const { Content } = Layout;

// 初始化Probe-X SDK
initProbeX();

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <div className="ecommerce-demo">
        <Router>
          <Layout>
            <Header />
            <Content className="main-content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/products" element={<ProductListPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<OrderListPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/profile" element={<UserProfilePage />} />
                <Route path="/search" element={<SearchResultsPage />} />
              </Routes>
            </Content>
            <Footer />
          </Layout>
        </Router>
      </div>
    </ConfigProvider>
  );
};

export default App;
