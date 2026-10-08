import { useState } from 'react'
import { message } from 'antd'
import { trackProductFavorite } from '../utils/probeX'
import { buildProductScm } from '../utils/trackingPoints'

// 商品收藏状态管理（内存态，页面刷新后重置），spm 为收藏点位的 SPM 编码；收藏是商品内容事件，统一带商品 SCM
export const useFavorites = (source: string, spm?: string) => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  const toggleFavorite = (product: any) => {
    const favorited = !favorites.has(product.id)

    setFavorites(prev => {
      const next = new Set(prev)
      if (favorited) {
        next.add(product.id)
      } else {
        next.delete(product.id)
      }
      return next
    })

    trackProductFavorite(favorited, {
      source,
      ...(spm ? { $spm: spm } : {}),
      $scm: buildProductScm(product.id),
    })
    message.success(favorited ? '已收藏' : '已取消收藏')
  }

  return { favorites, toggleFavorite }
}
