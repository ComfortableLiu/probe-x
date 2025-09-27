import { useEffect, useMemo, useRef } from "react"
import { useLocation } from "react-router-dom"
import { IAnyObj } from "@shared-types"
import { useNavigate } from "react-router"
import queryString from "query-string"
import { useSelector } from "react-redux"
import { RootState } from "@/store/storeContext"

export function useModel<T> (key: keyof RootState) {
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
    return (queryString.parse(location.search, {
      parseBooleans: true,
      parseNumbers: true,
    }) || {}) as T
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
    refresh: (query?: IAnyObj) => {
      navigate({
        pathname: location.pathname,
        search: query ? queryString.stringify(query) : location.search,
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
