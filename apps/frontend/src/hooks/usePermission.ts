import { useCallback } from 'react'
import { USER_INFO } from '@/constant/storage'
import { IUserInfo } from "@/models/application/type"
import { Localstorage } from "@utils/storage"
import { store } from "@/store/storeContext"

type IUsePermissionParams = [(permissionKey: string | string[]) => boolean]
const userInfo = Localstorage.get<IUserInfo>(USER_INFO) || { staffId: -1 }

// 权限
export function usePermission(): IUsePermissionParams {
  const validPathPermission = usePathPermission()

  const validPermission = (permissionKey: string | string[]) => {
    const pathname = location.pathname
    return validPathPermission(pathname, permissionKey)
  }
  return [validPermission]
}

function validatePermissionByPathname(roleRouterMap: {
  [key: string]: string[]
}, path: string, permissionKey: IPermissionKey) {
  // 缓存有就直接返回true
  if (CachePermission.queryPermission(path, permissionKey)) return true

  let result
  if (typeof permissionKey === 'string') {
    result = roleRouterMap[path] && roleRouterMap[path].includes(permissionKey)
  } else {
    result = permissionKey.some((key) => roleRouterMap[path]?.includes(key))
  }
  if (result) {
    // 缓存有权限的pathname
    CachePermission.cachePath(path, permissionKey)
  }
  return result
}

// 校验路由权限
export function usePathPermission() {
  // 从 store 获取权限信息
  const { permissionInfo } = store.getState().userModel

  // 校验对应pathname是否有这个权限
  const validPathPermission = useCallback(
    (pathname: string, permissionKey?: string | string[]) => {
      if (!permissionKey) return true

      // 如果不传permissionKey的话就直接检索是否有进入这个页面的权限
      if (!permissionKey) {
        return !!permissionInfo[pathname]
      }

      // ===== 校验权限
      const validateResult = validatePermissionByPathname(permissionInfo || {}, pathname, permissionKey)

      return validateResult
    },
    [permissionInfo],
  )
  return validPathPermission
}

type IPermissionKey = string | string[]

export class CachePermission {
  static hasPermissionKeyPath: Set<string> = new Set()

  // 构建key
  static buildKey(path: string, permissionKey: IPermissionKey) {
    return `${userInfo.staffId}-${path}-${typeof permissionKey === 'string' ? permissionKey : permissionKey!.join(',')}`
  }

  // 缓存权限
  static cachePath(path: string, permissionKey: IPermissionKey) {
    this.hasPermissionKeyPath.add(this.buildKey(path, permissionKey))
  }

  // 查询权限
  static queryPermission(path: string, permission: IPermissionKey) {
    return this.hasPermissionKeyPath.has(this.buildKey(path, permission))
  }
}
