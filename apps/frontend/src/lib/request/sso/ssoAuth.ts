// import env from "@/patch/env"
import { KEY_ACCESS_TOKEN, USER_INFO } from "@/constant/storage"
import { Localstorage } from "@utils/storage"
import { get } from "@config"

const KEY_CLIENT_ID = 'probe-x'

const ssoURL = get('ssoUrl')

function getAccessToken() {
  return Localstorage.get<string>(KEY_ACCESS_TOKEN)
}

/**
 * 请求登录态，并跳转到登录页
 */
function gotoLoginPage() {
  Localstorage.remove(USER_INFO)
  Localstorage.remove(KEY_ACCESS_TOKEN)
  window.location.href = `${ssoURL}/login?clientId=${KEY_CLIENT_ID}&responseType=token&redirectUri=${encodeURIComponent(
    window.location.href,
  )}`
}

export default {
  gotoLoginPage,
  getAccessToken,
}
