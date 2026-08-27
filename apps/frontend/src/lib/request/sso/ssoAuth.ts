// import env from "@/patch/env"
import { KEY_ACCESS_TOKEN, KEY_REFRESH_TOKEN, USER_INFO } from "@/constant/storage"
import { Localstorage } from "@utils/storage"
import { CachePermission } from "@/hooks/usePermission"
import { get } from "@config"

const KEY_CLIENT_ID = 'probe-x'

const ssoURL = get('ssoUrl')

/**
 * 请求登录态，并跳转到登录页
 */
function gotoLoginPage() {
  Localstorage.remove(USER_INFO)
  Localstorage.remove(KEY_REFRESH_TOKEN)
  Localstorage.remove(KEY_ACCESS_TOKEN)
  // 登出时清空权限缓存，避免换号后串权限
  CachePermission.clear()
  window.location.href = `${ssoURL}/login?clientId=${KEY_CLIENT_ID}&redirectUri=${encodeURIComponent(
    window.location.href,
  )}`
}

export default {
  gotoLoginPage,
}
