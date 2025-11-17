import { flatRoutes } from "@/router"
import queryString from "query-string"

/**
 * 检查是否是内部拥有的路由
 */
function checkIsInternalRoute(path: string) {
  return !!flatRoutes.get(path)
}

export function getParamsOrQuery<T = any>(search?: string) {
  const obj = (queryString.parse(search || location.search, {
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
}
