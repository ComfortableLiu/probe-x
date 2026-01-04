import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { SystemConfigUserService } from './user.service'
import {
  IQueryUserListReq,
  IQueryUserListRes,
  ICreateUserReq,
  ICreateUserRes,
  IUpdateUserReq,
  IUpdateUserRes,
  IDeleteUserReq,
  IResetPasswordReq,
  IResetPasswordRes,
  IAssignRolesReq,
  IAssignRolesRes,
  IQueryRoleListRes,
} from '@probe-x/shared-types/src'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common'

@Controller('/system-config')
export class SystemConfigController {
  constructor(
    private readonly userService: SystemConfigUserService,
  ) {}

  /**
   * 获取用户列表
   */
  @Get('user/list')
  async getUserList(
    @Query('username') username?: string,
    @Query('email') email?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryUserListRes> {
    const params: IQueryUserListReq = {
      username,
      email,
      isActive: isActive === 'true' || isActive === '1' ? true : isActive === 'false' || isActive === '0' ? false : undefined,
      page: page || 1,
      pageSize: pageSize || 20,
    }
    return await this.userService.getUserList(params)
  }

  /**
   * 创建用户
   */
  @Post('user/create')
  async createUser(
    @Body() body: ICreateUserReq,
  ): Promise<ResponseData<ICreateUserRes>> {
    return await this.userService.createUser(body)
  }

  /**
   * 更新用户
   */
  @Post('user/update')
  async updateUser(
    @Body() body: IUpdateUserReq,
  ): Promise<ResponseData<IUpdateUserRes>> {
    return await this.userService.updateUser(body)
  }

  /**
   * 删除用户
   */
  @Post('user/delete')
  async deleteUser(
    @Body() body: IDeleteUserReq,
  ): Promise<ResponseData<null>> {
    return await this.userService.deleteUser(body.userId)
  }

  /**
   * 重置密码
   */
  @Post('user/resetPassword')
  async resetPassword(
    @Body() body: IResetPasswordReq,
  ): Promise<ResponseData<IResetPasswordRes>> {
    return await this.userService.resetPassword(body.userId, body.newPassword)
  }

  /**
   * 分配角色
   */
  @Post('user/assignRoles')
  async assignRoles(
    @Body() body: IAssignRolesReq,
  ): Promise<ResponseData<IAssignRolesRes>> {
    return await this.userService.assignRoles(body.userId, body.roleIds)
  }

  /**
   * 获取角色列表
   */
  @Get('role/list')
  async getRoleList(): Promise<IQueryRoleListRes> {
    return await this.userService.getRoleList()
  }
}

