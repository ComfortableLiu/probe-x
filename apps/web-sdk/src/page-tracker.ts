/**
 * 页面浏览实例追踪器
 *
 * 维护「本次页面浏览」与「上一次页面浏览」的 id，仅内存态：
 * SPA 中由 page_view 事件驱动轮换，MPA 刷新后自然重置。
 * 会话切割由服务端完成，这里不持久化、不复用 session 逻辑。
 */

import { v4 as uuidv4 } from 'uuid'

export class PageTracker {
  private currentPageViewId: string = ''
  private prevPageViewId: string = ''

  /**
   * 开始一次新的页面浏览：轮换 id 并返回本次页面浏览 id
   */
  rotate(): string {
    this.prevPageViewId = this.currentPageViewId
    this.currentPageViewId = uuidv4()
    return this.currentPageViewId
  }

  /**
   * 当前页面浏览 id（尚无 page_view 时为 ''）
   */
  getPageId(): string {
    return this.currentPageViewId
  }

  /**
   * 上一次页面浏览 id（首个页面为 ''）
   */
  getSourcePageId(): string {
    return this.prevPageViewId
  }
}
