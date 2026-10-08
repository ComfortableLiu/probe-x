/**
 * SPM/SCM 点位编码常量
 *
 * 所有 code 均来自「点位管理」系统（tracking_node 表）中已建好的编码树，
 * 业务代码只允许引用本文件的常量，禁止出现裸 code 字符串。
 * 编码格式：点分拼接，如 `SZZsKOvk.cr7Hcdf3.Y51M7lsf.V8hk6K4L`；
 * 树上没有对应点位的事件，给到已定义的最深祖先层级即可。
 *
 * 空维度规则：四维码中某一维度因业务原因为空时，句点不能省略，
 * 必须保留位置占位（如 `A..C.`、`A...D`）——解析侧按「位置即层级」处理，
 * 第 N 段恒对应第 N 层。joinCode 不会丢弃空串，调用方传 '' 占位即可。
 */

/** 拼接点位编码 */
const joinCode = (...codes: string[]) => codes.join('.')

// ============================== SPM（站内点位） ==============================

/** SPM A 段：业务线 - ecommerce */
export const SPM_BUSINESS = 'SZZsKOvk'

/** SPM B 段：页面 */
export const SPM_PAGE = {
  /** 首页 */
  HOME: 'Qp24l0qp',
  /** 商品列表 */
  PRODUCT_LIST: 'cr7Hcdf3',
  /** 商品详情 */
  PRODUCT_DETAIL: 'ii2K07iC',
  /** 购物车 */
  CART: 'S2d2RYe2',
  /** 结算页 */
  CHECKOUT: 'cbc3XSJM',
  /** 搜索结果 */
  SEARCH_RESULTS: 'xm7eCXUG',
}

/** SPM C 段：模块 */
export const SPM_MODULE = {
  /** 首页 - 轮播Banner */
  HOME_BANNER: 'pHvXLWvP',
  /** 首页 - 分类导航 */
  HOME_CATEGORY_NAV: 'WknJjIWA',
  /** 首页 - 推荐商品 */
  HOME_RECOMMEND: 'A3jEfrLZ',
  /** 商品列表 - 商品卡片 */
  LIST_PRODUCT_CARD: 'Y51M7lsf',
  /** 商品列表 - 筛选器 */
  LIST_FILTER: 'tpUvx4ng',
  /** 商品详情 - 购买区域 */
  DETAIL_PURCHASE: 'gj27izIF',
  /** 购物车 - 商品列表 */
  CART_ITEM_LIST: 'Z4sA4qV7',
  /** 购物车 - 结算区域 */
  CART_SETTLEMENT: 'nNqpf6dr',
  /** 结算页 - 支付区域 */
  CHECKOUT_PAYMENT: 'LpcDBgbV',
  /** 搜索结果 - 结果列表 */
  SEARCH_RESULT_LIST: 'Nz1IYyR7',
}

/** SPM D 段：点位 */
export const SPM_NODE = {
  /** 首页 - 轮播Banner - Banner点击 */
  HOME_BANNER_CLICK: 'ZI8C3p7r',
  /** 首页 - 分类导航 - 分类点击 */
  HOME_CATEGORY_CLICK: '5zJYiUHK',
  /** 首页 - 推荐商品 - 商品卡片点击 */
  HOME_PRODUCT_CLICK: '700OAv5O',
  /** 首页 - 推荐商品 - 加入购物车 */
  HOME_ADD_TO_CART: 'sodI5RFn',
  /** 首页 - 推荐商品 - 商品曝光 */
  HOME_PRODUCT_EXPOSURE: 'bYw8k7wx',
  /** 首页 - 推荐商品 - 收藏 */
  HOME_FAVORITE: 'amHMjaWM',
  /** 商品列表 - 商品卡片 - 点击商品 */
  LIST_PRODUCT_CLICK: 'V8hk6K4L',
  /** 商品列表 - 商品卡片 - 快速加购 */
  LIST_QUICK_ADD_TO_CART: 'mk5QHRJW',
  /** 商品列表 - 商品卡片 - 商品曝光 */
  LIST_PRODUCT_EXPOSURE: 'RdQcLKhB',
  /** 商品列表 - 商品卡片 - 收藏 */
  LIST_FAVORITE: '5GcSgV7x',
  /** 商品列表 - 筛选器 - 分类筛选 */
  LIST_CATEGORY_FILTER: 'FvCYYji1',
  /** 商品列表 - 筛选器 - 品牌筛选 */
  LIST_BRAND_FILTER: 'Uizu2ILu',
  /** 商品列表 - 筛选器 - 排序切换 */
  LIST_SORT_CHANGE: 'VcGiLZ61',
  /** 商品列表 - 筛选器 - 清除筛选 */
  LIST_CLEAR_FILTER: 'm3HYMlYP',
  /** 商品详情 - 购买区域 - 加入购物车 */
  DETAIL_ADD_TO_CART: 'TQnW2fqj',
  /** 商品详情 - 购买区域 - 立即购买 */
  DETAIL_BUY_NOW: 'w7Ekd8iA',
  /** 商品详情 - 购买区域 - 收藏 */
  DETAIL_FAVORITE: 'PAwoDZhm',
  /** 购物车 - 商品列表 - 删除商品 */
  CART_REMOVE_ITEM: 'JeIqaMbo',
  /** 购物车 - 商品列表 - 修改数量 */
  CART_QUANTITY_CHANGE: 'e7b2tDvD',
  /** 购物车 - 商品列表 - 勾选商品 */
  CART_ITEM_SELECT: '7RyV4G3A',
  /** 购物车 - 商品列表 - 全选 */
  CART_SELECT_ALL: 'DHvymJv5',
  /** 购物车 - 结算区域 - 去结算 */
  CART_CHECKOUT: '4yxQoEfJ',
  /** 结算页 - 支付区域 - 提交订单 */
  CHECKOUT_SUBMIT_ORDER: 'SpsC6YE8',
  /** 结算页 - 支付区域 - 支付方式切换 */
  CHECKOUT_PAYMENT_SWITCH: 'cKgDgpVF',
  /** 搜索结果 - 结果列表 - 点击商品 */
  SEARCH_PRODUCT_CLICK: 'VH6u5p8s',
  /** 搜索结果 - 结果列表 - 商品曝光 */
  SEARCH_PRODUCT_EXPOSURE: 'qO8se58P',
  /** 搜索结果 - 结果列表 - 收藏 */
  SEARCH_FAVORITE: 'S2bABgzZ',
  /** 搜索结果 - 结果列表 - 快速加购 */
  SEARCH_QUICK_ADD_TO_CART: '9QN6eCXh',
}

/** SPM 页面级路径（业务线.页面，两段），用于 page_view 及无更深点位的事件 */
export const SPM_PAGE_PATH = {
  /** 首页 */
  HOME: joinCode(SPM_BUSINESS, SPM_PAGE.HOME),
  /** 商品列表 */
  PRODUCT_LIST: joinCode(SPM_BUSINESS, SPM_PAGE.PRODUCT_LIST),
  /** 商品详情 */
  PRODUCT_DETAIL: joinCode(SPM_BUSINESS, SPM_PAGE.PRODUCT_DETAIL),
  /** 购物车 */
  CART: joinCode(SPM_BUSINESS, SPM_PAGE.CART),
  /** 结算页 */
  CHECKOUT: joinCode(SPM_BUSINESS, SPM_PAGE.CHECKOUT),
  /** 搜索结果 */
  SEARCH_RESULTS: joinCode(SPM_BUSINESS, SPM_PAGE.SEARCH_RESULTS),
}

/** SPM 模块级路径（业务线.页面.模块，三段），用于树上没有 D 段点位的事件 */
export const SPM_MODULE_PATH = {
  /** 商品列表 - 商品卡片 */
  LIST_PRODUCT_CARD: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_PRODUCT_CARD),
  /** 商品列表 - 筛选器 */
  LIST_FILTER: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_FILTER),
  /** 商品详情 - 购买区域 */
  DETAIL_PURCHASE: joinCode(SPM_PAGE_PATH.PRODUCT_DETAIL, SPM_MODULE.DETAIL_PURCHASE),
  /** 购物车 - 商品列表 */
  CART_ITEM_LIST: joinCode(SPM_PAGE_PATH.CART, SPM_MODULE.CART_ITEM_LIST),
  /** 结算页 - 支付区域 */
  CHECKOUT_PAYMENT: joinCode(SPM_PAGE_PATH.CHECKOUT, SPM_MODULE.CHECKOUT_PAYMENT),
  /** 搜索结果 - 结果列表 */
  SEARCH_RESULT_LIST: joinCode(SPM_PAGE_PATH.SEARCH_RESULTS, SPM_MODULE.SEARCH_RESULT_LIST),
}

/** SPM 点位级完整编码（业务线.页面.模块.点位，四段） */
export const SPM_POINT = {
  /** 首页 - 轮播Banner - Banner点击 */
  HOME_BANNER_CLICK: joinCode(SPM_PAGE_PATH.HOME, SPM_MODULE.HOME_BANNER, SPM_NODE.HOME_BANNER_CLICK),
  /** 首页 - 分类导航 - 分类点击 */
  HOME_CATEGORY_CLICK: joinCode(SPM_PAGE_PATH.HOME, SPM_MODULE.HOME_CATEGORY_NAV, SPM_NODE.HOME_CATEGORY_CLICK),
  /** 首页 - 推荐商品 - 商品卡片点击 */
  HOME_PRODUCT_CLICK: joinCode(SPM_PAGE_PATH.HOME, SPM_MODULE.HOME_RECOMMEND, SPM_NODE.HOME_PRODUCT_CLICK),
  /** 首页 - 推荐商品 - 加入购物车 */
  HOME_ADD_TO_CART: joinCode(SPM_PAGE_PATH.HOME, SPM_MODULE.HOME_RECOMMEND, SPM_NODE.HOME_ADD_TO_CART),
  /** 首页 - 推荐商品 - 商品曝光 */
  HOME_PRODUCT_EXPOSURE: joinCode(SPM_PAGE_PATH.HOME, SPM_MODULE.HOME_RECOMMEND, SPM_NODE.HOME_PRODUCT_EXPOSURE),
  /** 首页 - 推荐商品 - 收藏 */
  HOME_FAVORITE: joinCode(SPM_PAGE_PATH.HOME, SPM_MODULE.HOME_RECOMMEND, SPM_NODE.HOME_FAVORITE),
  /** 商品列表 - 商品卡片 - 点击商品 */
  LIST_PRODUCT_CLICK: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_PRODUCT_CARD, SPM_NODE.LIST_PRODUCT_CLICK),
  /** 商品列表 - 商品卡片 - 快速加购 */
  LIST_QUICK_ADD_TO_CART: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_PRODUCT_CARD, SPM_NODE.LIST_QUICK_ADD_TO_CART),
  /** 商品列表 - 商品卡片 - 商品曝光 */
  LIST_PRODUCT_EXPOSURE: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_PRODUCT_CARD, SPM_NODE.LIST_PRODUCT_EXPOSURE),
  /** 商品列表 - 商品卡片 - 收藏 */
  LIST_FAVORITE: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_PRODUCT_CARD, SPM_NODE.LIST_FAVORITE),
  /** 商品列表 - 筛选器 - 分类筛选 */
  LIST_CATEGORY_FILTER: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_FILTER, SPM_NODE.LIST_CATEGORY_FILTER),
  /** 商品列表 - 筛选器 - 品牌筛选 */
  LIST_BRAND_FILTER: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_FILTER, SPM_NODE.LIST_BRAND_FILTER),
  /** 商品列表 - 筛选器 - 排序切换 */
  LIST_SORT_CHANGE: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_FILTER, SPM_NODE.LIST_SORT_CHANGE),
  /** 商品列表 - 筛选器 - 清除筛选 */
  LIST_CLEAR_FILTER: joinCode(SPM_PAGE_PATH.PRODUCT_LIST, SPM_MODULE.LIST_FILTER, SPM_NODE.LIST_CLEAR_FILTER),
  /** 商品详情 - 购买区域 - 加入购物车 */
  DETAIL_ADD_TO_CART: joinCode(SPM_PAGE_PATH.PRODUCT_DETAIL, SPM_MODULE.DETAIL_PURCHASE, SPM_NODE.DETAIL_ADD_TO_CART),
  /** 商品详情 - 购买区域 - 立即购买 */
  DETAIL_BUY_NOW: joinCode(SPM_PAGE_PATH.PRODUCT_DETAIL, SPM_MODULE.DETAIL_PURCHASE, SPM_NODE.DETAIL_BUY_NOW),
  /** 商品详情 - 购买区域 - 收藏 */
  DETAIL_FAVORITE: joinCode(SPM_PAGE_PATH.PRODUCT_DETAIL, SPM_MODULE.DETAIL_PURCHASE, SPM_NODE.DETAIL_FAVORITE),
  /** 购物车 - 商品列表 - 删除商品 */
  CART_REMOVE_ITEM: joinCode(SPM_PAGE_PATH.CART, SPM_MODULE.CART_ITEM_LIST, SPM_NODE.CART_REMOVE_ITEM),
  /** 购物车 - 商品列表 - 修改数量 */
  CART_QUANTITY_CHANGE: joinCode(SPM_PAGE_PATH.CART, SPM_MODULE.CART_ITEM_LIST, SPM_NODE.CART_QUANTITY_CHANGE),
  /** 购物车 - 商品列表 - 勾选商品 */
  CART_ITEM_SELECT: joinCode(SPM_PAGE_PATH.CART, SPM_MODULE.CART_ITEM_LIST, SPM_NODE.CART_ITEM_SELECT),
  /** 购物车 - 商品列表 - 全选 */
  CART_SELECT_ALL: joinCode(SPM_PAGE_PATH.CART, SPM_MODULE.CART_ITEM_LIST, SPM_NODE.CART_SELECT_ALL),
  /** 购物车 - 结算区域 - 去结算 */
  CART_CHECKOUT: joinCode(SPM_PAGE_PATH.CART, SPM_MODULE.CART_SETTLEMENT, SPM_NODE.CART_CHECKOUT),
  /** 结算页 - 支付区域 - 提交订单 */
  CHECKOUT_SUBMIT_ORDER: joinCode(SPM_PAGE_PATH.CHECKOUT, SPM_MODULE.CHECKOUT_PAYMENT, SPM_NODE.CHECKOUT_SUBMIT_ORDER),
  /** 结算页 - 支付区域 - 支付方式切换 */
  CHECKOUT_PAYMENT_SWITCH: joinCode(SPM_PAGE_PATH.CHECKOUT, SPM_MODULE.CHECKOUT_PAYMENT, SPM_NODE.CHECKOUT_PAYMENT_SWITCH),
  /** 搜索结果 - 结果列表 - 点击商品 */
  SEARCH_PRODUCT_CLICK: joinCode(SPM_PAGE_PATH.SEARCH_RESULTS, SPM_MODULE.SEARCH_RESULT_LIST, SPM_NODE.SEARCH_PRODUCT_CLICK),
  /** 搜索结果 - 结果列表 - 商品曝光 */
  SEARCH_PRODUCT_EXPOSURE: joinCode(SPM_PAGE_PATH.SEARCH_RESULTS, SPM_MODULE.SEARCH_RESULT_LIST, SPM_NODE.SEARCH_PRODUCT_EXPOSURE),
  /** 搜索结果 - 结果列表 - 收藏 */
  SEARCH_FAVORITE: joinCode(SPM_PAGE_PATH.SEARCH_RESULTS, SPM_MODULE.SEARCH_RESULT_LIST, SPM_NODE.SEARCH_FAVORITE),
  /** 搜索结果 - 结果列表 - 快速加购 */
  SEARCH_QUICK_ADD_TO_CART: joinCode(SPM_PAGE_PATH.SEARCH_RESULTS, SPM_MODULE.SEARCH_RESULT_LIST, SPM_NODE.SEARCH_QUICK_ADD_TO_CART),
}

// ============================== SCM（站外/流量来源点位） ==============================

/** SCM A 段：内容来源 ID（内容是从哪里来的） - 自然流量 */
export const SCM_CHANNEL = '5SKh0ei6'

/** SCM B 段：配置方式 ID（用什么方式配置的） */
export const SCM_SOURCE = {
  /** 直接访问 */
  DIRECT: 'AvfWBw6q',
  /** 用户搜索 */
  SEARCH: 'a0KW6pYd',
  /** 算法推荐 */
  RECOMMEND: 'tPRMnFMr',
}

/** SCM C 段：内容类型 ID（内容的类型） */
export const SCM_ENTRANCE = {
  /** 首页入口 */
  HOME: 'Peujm6dL',
  /** 搜索结果 */
  SEARCH_RESULTS: 'J3YtGs8o',
  /** 商品 */
  PRODUCT: 'OWbmcxXw',
}

/** SCM D 段：内容 ID（唯一标识当前内容） */
export const SCM_POSITION = {
  /** 推荐位 */
  RECOMMEND: 'y6MEn5NV',
  /** 关键词匹配 */
  KEYWORD_MATCH: 'LuTooR2j',
  /** 新品推荐 */
  NEW_PRODUCT: 'CSBSx3zQ',
  /** 热门商品 */
  HOT_PRODUCT: 'vh3gD4KZ',
}

/** SCM 组合编码（来源.配置方式.内容类型.内容ID，四段） */
export const SCM_POINT = {
  /** 自然流量 - 直接访问 - 首页入口 - 推荐位（首页/列表/详情/购物车/结算页的 page_view 使用） */
  DIRECT_HOME: joinCode(SCM_CHANNEL, SCM_SOURCE.DIRECT, SCM_ENTRANCE.HOME, SCM_POSITION.RECOMMEND),
  /** 自然流量 - 用户搜索 - 搜索结果 - 关键词匹配（搜索结果页的 page_view 使用） */
  SEARCH_RESULTS: joinCode(SCM_CHANNEL, SCM_SOURCE.SEARCH, SCM_ENTRANCE.SEARCH_RESULTS, SCM_POSITION.KEYWORD_MATCH),
}

// ============================== SCM D 段：注册内容编码 ==============================
// D = 内容 ID，标识当前模块里的具体内容（商品 → spuCode，文字 → 文字本身，图片 → 图片链接），
// 每个内容都在点位管理中注册了 D 节点（name = 内容本体），上报带 D 编码即可反解出内容。

/** 商品内容 D 段：商品 id（spuCode） → code，挂在 自然流量.算法推荐.商品 下 */
export const SCM_PRODUCT_D: Record<string, string> = {
  '1': 'vpBhIXYN',
  '2': 'Fk9y445c',
  '3': 'Gpn7K2GA',
  '4': 'XAm0hbvP',
  '5': 'IPEdwZTH',
  '6': 'tugW0X7U',
  '7': 'uoGUT9L9',
  '8': 'G3hfgMTH',
  '9': 'xHdCLc8q',
  '10': 'snR12Olp',
  '11': 'Jhti5jop',
  '12': 'NRWflPvR',
  '13': 'gGtZNvuc',
  '14': 'ggtfoTqg',
  '15': 'R2hDoyZE',
  '16': 'SJKd2GE5',
  '17': 'DaIlXwPp',
  '18': 'H03meUwv',
  '19': 'TA6esC6W',
  '20': '1U4Mhyah',
}

/** 分类导航文字 D 段：分类名 → code，挂在 自然流量.直接访问.首页入口 下 */
export const SCM_CATEGORY_D: Record<string, string> = {
  手机数码: 'yEzcFNUu',
  电脑办公: 'gisnBjUn',
  平板电脑: 'licAX5HE',
  智能穿戴: 'fN7AoH7f',
  数码配件: 'kM2cfOXB',
}

/** Banner 图片 D 段：按轮播顺序（index）对应图片链接 code，挂在 自然流量.直接访问.首页入口 下 */
export const SCM_BANNER_D: string[] = [
  'UIJfA2Ok',
  'YNUCUApJ',
  'YTej9kGe',
]

/** SCM 路径：自然流量 - 算法推荐 - 商品（三段），商品内容事件的统一 SCM 前缀 */
export const SCM_PRODUCT_PATH = joinCode(SCM_CHANNEL, SCM_SOURCE.RECOMMEND, SCM_ENTRANCE.PRODUCT)

/** SCM 路径：自然流量 - 直接访问 - 首页入口（三段），分类/Banner 内容事件的统一 SCM 前缀 */
export const SCM_DIRECT_HOME_PATH = joinCode(SCM_CHANNEL, SCM_SOURCE.DIRECT, SCM_ENTRANCE.HOME)

/** 商品内容 SCM：自然流量.算法推荐.商品.<商品D>，未注册的商品 id 回退到三段（不抛错） */
export const buildProductScm = (productId: string): string => {
  const code = SCM_PRODUCT_D[productId]
  return code ? joinCode(SCM_PRODUCT_PATH, code) : SCM_PRODUCT_PATH
}

/** 分类导航 SCM：自然流量.直接访问.首页入口.<分类D>，未注册的分类名回退到三段（不抛错） */
export const buildCategoryScm = (categoryName: string): string => {
  const code = SCM_CATEGORY_D[categoryName]
  return code ? joinCode(SCM_DIRECT_HOME_PATH, code) : SCM_DIRECT_HOME_PATH
}

/** Banner 图片 SCM：自然流量.直接访问.首页入口.<BannerD>，未注册的 index 回退到三段（不抛错） */
export const buildBannerScm = (index: number): string => {
  const code = SCM_BANNER_D[index]
  return code ? joinCode(SCM_DIRECT_HOME_PATH, code) : SCM_DIRECT_HOME_PATH
}
