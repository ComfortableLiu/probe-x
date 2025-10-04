import { flatRoutes } from "@/router"
import type { IAnyObj } from "@probe-x/shared-types/src"
import queryString from "query-string"

/**
 * 检查是否是内部拥有的路由
 */
function checkIsInternalRoute(path: string) {
  return !!flatRoutes.get(path)
}

export function getParamsOrQuery(): IAnyObj {
  return queryString.parse(location.search, {
    parseBooleans: true,
    parseNumbers: true,
  })
}
