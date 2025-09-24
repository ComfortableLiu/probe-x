import { useEffect, useMemo, useRef } from "react"
// import { getQuery } from "@/lib/utils"
import { useLocation } from "react-router-dom"

export function useQuery() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  return useMemo(() => getQuery(location.search), [location.search]) as any
}

export function useHistoryListener(fn: (location: Location) => void) {
  const location = useLocation() as unknown as Location
  useEffect(() => fn && fn(location), [location])
}

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
