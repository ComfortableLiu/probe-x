// 商品类型
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  brand: string;
  stock: number;
  rating: number;
  reviewCount: number;
  sales: number;
  tags?: string[];
  specifications?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// 用户类型
export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  gender?: string;
  birthday?: string;
  address: Address[];
  createdAt: string;
  lastLoginAt?: string;
}

// 地址类型
export interface Address {
  id: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  postalCode?: string;
  isDefault: boolean;
}

// 购物车商品类型
export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selected: boolean;
}

// 订单类型
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  discountAmount: number;
  shippingFee: number;
  finalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingAddress: Address;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

// 订单商品类型
export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  price: number;
  totalPrice: number;
}

// 订单状态
export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

// 支付状态
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// 分类类型
export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  parentId?: string;
  sort: number;
}

// 搜索参数类型
export interface SearchParams {
  keyword?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// 搜索结果类型
export interface SearchResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 用户统计类型
export interface UserStats {
  totalOrders: number;
  totalSpent: number;
  favoriteCategory: string;
  averageOrderValue: number;
  lastOrderDate: string;
}

// 商品评价类型
export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  content: string;
  images?: string[];
  helpful: number;
  createdAt: string;
}

// 优惠券类型
export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed';
  value: number;
  minAmount: number;
  maxDiscount?: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
}

// 支付方式类型
export interface PaymentMethod {
  id: string;
  name: string;
  type: 'alipay' | 'wechat' | 'bank' | 'credit';
  icon: string;
  enabled: boolean;
  sort: number;
}

// 物流信息类型
export interface ShippingInfo {
  orderId: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  events: ShippingEvent[];
}

// 物流事件类型
export interface ShippingEvent {
  time: string;
  status: string;
  location: string;
  description: string;
}
