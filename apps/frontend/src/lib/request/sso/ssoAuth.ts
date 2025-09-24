// import env from "@/patch/env"
import { KEY_ACCESS_TOKEN, USER_INFO } from "@/constant/storage"
import { Localstorage } from "@utils/storage"

const KEY_CLIENT_ID = 'probe-x'

function getAccessToken() {
  return Localstorage.get<string>(KEY_ACCESS_TOKEN)
}

/**
 * sso登陆
 */
function ssoLogin() {
  Localstorage.remove(USER_INFO)
  Localstorage.remove(KEY_ACCESS_TOKEN)
  window.location.href = `${env.ssoURL}/oauth/authorize?client_id=${KEY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(
    window.location.href,
  )}`
}

/**
 * sso退出登陆
 */
function ssoLogout() {
  Localstorage.remove(USER_INFO)
  Localstorage.remove(KEY_ACCESS_TOKEN)
  window.location.href = `${env.ssoURL}/logout?ciderAccessToken=${
    getAccessToken()
  }&client_id=${KEY_CLIENT_ID}&redirect_uri=${window.location.href}`
}

export default {
  ssoLogin,
  ssoLogout,
  // getAccessToken,
}
