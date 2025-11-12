import { useEffect, useMemo, useRef } from "react"
import { useLocation } from "react-router-dom"
import { IAnyObj } from "@probe-x/shared-types/src/index"
import { useNavigate } from "react-router"
import queryString from "query-string"
import { useSelector } from "react-redux"
import { RootState } from "@/store/storeContext"

export function useModel<T>(key: keyof RootState) {
  return useSelector((store: RootState) => store[key] as T)
}

/**
 * loading
 */
export const useLoading = () => useSelector((store: RootState) => store.loading.effects)

/**
 * 解析query的hooks
 */
export function useQuery<T = IAnyObj>() {
  const location = useLocation()

  return useMemo<T>(() => {
    const obj = (queryString.parse(location.search, {
      parseBooleans: true,
      parseNumbers: true,
    }) || {})
    const query = {}
    Object.keys(obj).forEach(key => {
      try {
        query[key] = JSON.parse(`${obj[key]}`)
      } catch (e) {
        query[key] = obj[key]
      }
    })
    return query as T
  }, [location.search])
}

/**
 * 监听history
 */
export function useHistoryListener(fn: (location: Location) => void) {
  const location = useLocation() as unknown as Location
  useEffect(() => fn && fn(location), [fn, location])
}

/**
 * 完整版路由操作hooks
 */
export function useRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  return {
    location,
    navigate,
    /**
     * 刷新路由
     * @param query 参数
     * @param retainOldQuery 是否保留旧字段，但是相同的key还是会覆盖的，如果不想覆盖，需要在自行处理
     */
    refresh: (query?: IAnyObj, retainOldQuery?: boolean) => {
      let search: string
      const obj = {}
      Object.keys(query || {}).forEach(key => {
        if (typeof query[key] === 'object') {
          obj[key] = JSON.stringify(query[key])
        } else {
          obj[key] = query[key]
        }
      })
      if (retainOldQuery) {
        search = queryString.stringify({
          ...queryString.parse(location.search),
          ...(obj || {}),
        })
      } else {
        search = queryString.stringify(obj || {})
      }

      navigate({
        pathname: location.pathname,
        search,
      })
    },
    goBack: () => navigate(-1),
    goForward: () => navigate(1),
    go: (path: string) => navigate(path),
  }
}

/**
 * 循环定时hooks
 * @param fun
 * @param delay
 */
export function useInterval(fun: () => void, delay = 1000) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current = fun
  })

  useEffect(() => {
    const timer = setInterval(() => ref.current(), delay)
    return () => clearInterval(timer)
  }, [delay])
}
