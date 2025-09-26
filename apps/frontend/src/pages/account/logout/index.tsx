import React, { useEffect } from "react"
import ssoAuth from "@/lib/request/sso/ssoAuth"

function Logout() {

  useEffect(() => ssoAuth.gotoLoginPage())

  return <>退出登录中 ...</>
}

export default Logout