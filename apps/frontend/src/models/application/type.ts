export interface IApplicationState {
  userInfo: IUserInfo;
  roleRouterMap: { [key: string]: string[] };
}

// 用户信息
export interface IUserInfo {
  avatar: string;
  email: string;
  name: string;
  roleArray: Array<{ [key: string]: number }>;
  staffId: number;
  permissionList: {
    [key: string]: string[]
  }
}

export interface IQueryUserInfoParams {
  accessToken: string;
}
