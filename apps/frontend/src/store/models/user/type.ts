import { IPermissionRes, IUser } from "@probe-x/shared-types/src/index"

export interface IUserModel {
  userInfo?: IUser;
  permissionInfo?: IPermissionRes;
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
