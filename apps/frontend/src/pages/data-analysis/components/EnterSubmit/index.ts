import { KeyboardEvent, useCallback, useEffect, useRef } from "react"

// 打开中的 antd 浮层选择器。Select/DatePicker 下拉渲染在 body portal 里，
// 但 React 合成事件仍会沿组件树冒泡到容器，浮层打开时回车属于浮层组件，不应提交查询
const OPEN_OVERLAY_SELECTORS = [
  '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
  '.ant-modal-wrap:not([style*="display: none"])',
  '.ant-drawer-open',
  '.ant-popover:not(.ant-popover-hidden)',
]

function hasOpenAntdOverlay() {
  return OPEN_OVERLAY_SELECTORS.some((selector) => Boolean(document.querySelector(selector)))
}

/**
 * 回车提交查询：把返回的 onKeyDown 铺到筛选配置区容器上，容器内任意输入框按回车 = 点「查询」
 *
 * 跳过条件：
 * - 目标元素是 TEXTAREA（多行文本换行是正常输入）
 * - 有 antd 浮层打开（此时回车属于浮层组件，如 Select 下拉确认选项）
 *
 * @param onSubmit 提交回调，允许 async，重复触发由提交内部的校验/loading 兜底
 */
export function useEnterSubmit(onSubmit: () => void | Promise<void>) {
  // ref 保存最新 onSubmit，避免 onKeyDown 闭包过期
  const onSubmitRef = useRef(onSubmit)
  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
    if (hasOpenAntdOverlay()) return
    onSubmitRef.current()
  }, [])

  return { onKeyDown }
}

export default useEnterSubmit
