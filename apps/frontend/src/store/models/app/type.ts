export interface IAppState {
  userInfo?: IUserInfo;
  permissionInfo?: IPermission;
}

// 用户信息
export interface IUserInfo {
  avatar: string;
  email: string;
  name: string;
  staffId: number;
}

export interface IQueryUserInfoParams {
  accessToken: string;
}

export interface IPermission {
  // 例：页面key:['子权限1','子权限2']
  [pageKey: string]: string[]
}
