import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { USER_INFO } from '@/constant/storage'
import { IPermissionRes, IUser } from "@probe-x/shared-types/src"
import { Localstorage } from "@utils/storage"
import { RootState } from "@/store/storeContext"

type IUsePermissionParams = [(permissionKey: string | string[]) => boolean]

// 权限
export function usePermission(): IUsePermissionParams {
  const validPathPermission = usePathPermission()

  const validPermission = (permissionKey: string | string[]) => {
    const pathname = location.pathname
    return validPathPermission(pathname, permissionKey)
  }
  return [validPermission]
}

function validatePermissionByPathname(permissionInfo: IPermissionRes, path: string, permissionKey: IPermissionKey) {
  // 缓存有就直接返回true
  if (CachePermission.queryPermission(path, permissionKey)) return true

  const permissionKeys = permissionInfo?.allPermissions?.map((item) => item.permissionKey) || []
  let result
  if (typeof permissionKey === 'string') {
    result = permissionKeys.includes(permissionKey)
  } else {
    result = permissionKey.some((key) => permissionKeys.includes(key))
  }
  if (result) {
    // 缓存有权限的pathname
    CachePermission.cachePath(path, permissionKey)
  }
  return result
}

// 校验路由权限
export function usePathPermission() {
  // 响应式订阅 store 中的权限信息
  const permissionInfo = useSelector((store: RootState) => store.userModel.permissionInfo)

  // 校验对应pathname是否有这个权限
  const validPathPermission = useCallback(
    (pathname: string, permissionKey?: string | string[]) => {
      // 不传permissionKey默认有权限
      if (!permissionKey) return true

      // ===== 校验权限
      const validateResult = validatePermissionByPathname(permissionInfo || {
        roles: [],
        allPermissions: [],
      }, pathname, permissionKey)

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
    const userInfo = Localstorage.get<IUser>(USER_INFO)
    return `${userInfo?.userId ?? 'anonymous'}-${path}-${typeof permissionKey === 'string' ? permissionKey : permissionKey!.join(',')}`
  }

  // 缓存权限
  static cachePath(path: string, permissionKey: IPermissionKey) {
    this.hasPermissionKeyPath.add(this.buildKey(path, permissionKey))
  }

  // 查询权限
  static queryPermission(path: string, permission: IPermissionKey) {
    return this.hasPermissionKeyPath.has(this.buildKey(path, permission))
  }

  // 清空缓存（登出/切换账号时调用，避免串号）
  static clear() {
    this.hasPermissionKeyPath.clear()
  }
}
