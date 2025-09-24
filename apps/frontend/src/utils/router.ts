import { flatRoutes } from "@/router"

/**
 * 检查是否是内部拥有的路由
 */
function checkIsInternalRoute(path: string) {
  return !!flatRoutes.get(path)
}
