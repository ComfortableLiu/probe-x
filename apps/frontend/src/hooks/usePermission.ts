import { useCallback } from 'react'
import { useApp } from './index'
import { USER_INFO } from '@/constant/storage'
import { IUserInfo } from "@/models/application/type"
import { useNavigator } from "@/routes/navigator"
import { Localstorage } from "@utils/storage"

type IUsePermissionParams = [roleRouterMap: any, getPermission: (permissionKey: string) => boolean]
const userInfo = (Localstorage.get(USER_INFO) as IUserInfo) || { staffId: -1 }

// 权限
export function usePermission (): IUsePermissionParams {
  const app = useApp()

  const { roleRouterMap } = app

  const validPathPermission = usePathPermission()

  const validPermission = (permissionKey: string | string[]) => {
    const pathname = location.pathname
    return validPathPermission(pathname, permissionKey)
  }
  return [roleRouterMap, validPermission]
}

function validatePermissionByPathname (roleRouterMap: { [key: string]: string[] }, path: string, permissionKey: IPermissionKey) {
  // 缓存有就直接返回true
  if (CachePermission.queryPermission(path, permissionKey)) return true

  let result = false
  if (typeof permissionKey === 'string') {
    result = roleRouterMap[path] && roleRouterMap[path].includes(permissionKey)
  } else {
    result = permissionKey.some((key) => roleRouterMap[path].includes(key))
  }
  if (result) {
    // 缓存有权限的pathname
    CachePermission.cachePath(path, permissionKey)
  }
  return result
}

// 校验路由权限
export function usePathPermission () {
  const app = useApp()
  const navigator = useNavigator()

  const { roleRouterMap } = app
  // 校验对应pathname是否有这个权限
  const validPathPermission = useCallback(
    (pathname: string, permissionKey?: string | string[]) => {
      if (!permissionKey) return true

      // 如果不传permissionKey的话就直接检索是否有进入这个页面的权限
      if (!permissionKey) {
        return !!roleRouterMap[pathname]
      }
      // 同样也需要查找父级页面的权限
      const parentPathname = navigator.getTopParentPathname()
      const currentAndPrePath = [pathname, parentPathname]

      // ===== 校验权限
      const validateRsult = currentAndPrePath.some((path) => validatePermissionByPathname(roleRouterMap, path, permissionKey))

      return validateRsult
    },
    [roleRouterMap],
  )
  return validPathPermission
}

// 校验是否允许跳转页面
export function useJumpPagePermision () {
  const { roleRouterMap } = useApp()
  return function (path: string) {
    return !!roleRouterMap[path]
  }
}

type IPermissionKey = string | string[]

export class CachePermission {
  static hasPermissionKeyPath: string[] = []

  // 构建key
  static buildKey (path: string, permissionKey: IPermissionKey) {
    return `${userInfo.staffId}-${path}-${typeof permissionKey === 'string' ? permissionKey : permissionKey!.join(',')}`
  }

  // 缓存权限
  static cachePath (path: string, permissionKey: IPermissionKey) {
    this.hasPermissionKeyPath.push(this.buildKey(path, permissionKey))
  }

  // 查询权限
  static queryPermission (path: string, permission: IPermissionKey) {
    return this.hasPermissionKeyPath.includes(this.buildKey(path, permission))
  }
}
