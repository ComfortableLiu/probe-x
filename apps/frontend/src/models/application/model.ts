import { makeAutoObservable } from "mobx"
import { IApplicationState, IUserInfo } from "./type"
import queryString from "query-string"
import { KEY_ACCESS_TOKEN, USER_INFO } from "@/constant/storage"
import { queryPermissionInfo, queryUserInfo } from "@/models/application/services"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { Localstorage } from "@utils/storage"

const initState: IApplicationState = {
  userInfo: {} as IUserInfo,
  roleRouterMap: {},
}

export class ApplicationStore {
  userInfo: IUserInfo = initState.userInfo
  roleRouterMap = initState.roleRouterMap

  constructor() {
    makeAutoObservable(this)
  }

  updateItem(payload: Partial<IApplicationState>) {
    Object.assign(this, payload)
  }

  async init() {
    // 初始化静态数据
    // dispatch.staticDataModel.updateStaticData()
    // 初始化路由、登录信息、权限
    await this.initLoginInfo()
    // 开始请求全局数据
    // this.initGlobalData()
    this.initHistoryListener()
    // 初始化日志服务
    // dispatch.logModel.init()
  }

  async initLoginInfo() {
    const { search, hash } = location
    const hashQuery = queryString.parse(hash)
    const query = queryString.parse(search)
    const { access_token } = hashQuery
    let token: string = Localstorage.get<string>(KEY_ACCESS_TOKEN) || ''
    if (!token) {
      Localstorage.remove(USER_INFO)
    }

    // 存在token则刷新一次用户信息
    if (access_token) {
      Localstorage.remove(KEY_ACCESS_TOKEN)
      if (Array.isArray(access_token)) {
        Localstorage.set(KEY_ACCESS_TOKEN, access_token[0])
        token = access_token[0] as string
      } else if (typeof access_token === 'string') {
        Localstorage.set(KEY_ACCESS_TOKEN, access_token)
        token = access_token
      }
      // TODO 裸的api太暴力了，要优化
      // history.replace(`${location.pathname}?${queryString.stringify(query)}`)
      window.location.replace(`${location.pathname}?${queryString.stringify(query)}`)
    }

    try {
      let userInfo = Localstorage.get(USER_INFO) as IUserInfo
      if (!userInfo || !userInfo.staffId) {
        const { data } = await queryUserInfo({
          accessToken: token,
        })
        userInfo = { ...data }
      }
      Localstorage.set(USER_INFO, userInfo)
      this.updateItem({
        userInfo: { ...userInfo },
      })

      // 更新用户权限信息
      const permissionRes = await queryPermissionInfo({
        project: 'probe-x',
      })

      const { permissionList } = permissionRes.data
      // 改造权限列表为map
      const roleRouterMap: { [key: string]: string[] } = { '/': [] }

      this.updateItem({
        roleRouterMap,
      })
    } catch (error: any) {
      console.log('error:', error)
      throw { msg: error.msg || '错误', code: error.code || 400 }
    }
  }

  initHistoryListener() {
    this.validRouter({
      pathname: location.pathname,
    })
  }

  // 校验路由权限
  async validRouter(payload: { pathname: string }) {
    const { pathname } = payload
    const token = Localstorage.get<string>(KEY_ACCESS_TOKEN)
    if (!token) {
      ssoAuth.gotoLoginPage()
      return
    }

    if (!Reflect.has(this.roleRouterMap, pathname) && pathname !== '/') {
      // TODO href太暴力了，要用自己的路由
      // history.push('/')
      window.location.href = '/'
      return
    }
  }
}
