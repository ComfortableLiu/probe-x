import { IPermission, IUser } from "@probe-x/shared-types/src/index"

export interface IUserModel {
  userInfo?: IUser;
  permissionInfo?: IPermission;
}

export interface ILoginRes {
  accessToken: string;
  refreshToken: string;
  userInfo: IUser;
}

export interface ILoginReq {
  username: string
  password: string
}
