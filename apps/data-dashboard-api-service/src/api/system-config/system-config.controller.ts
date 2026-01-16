import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { SystemConfigUserService } from './user.service'
import { SystemConfigRoleService } from './role.service'
import { SystemConfigSystemService } from './system.service'
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
  IQueryRoleManageListReq,
  IQueryRoleManageListRes,
  IRoleManageListItem,
  ICreateRoleReq,
  ICreateRoleRes,
  IUpdateRoleReq,
  IUpdateRoleRes,
  IDeleteRoleReq,
  IAssignPermissionsReq,
  IAssignPermissionsRes,
  IQueryPermissionListRes,
  IQuerySystemListReq,
  IQuerySystemListRes,
  ICreateSystemReq,
  ICreateSystemRes,
  IUpdateSystemReq,
  IUpdateSystemRes,
  IDeleteSystemReq,
} from '@probe-x/shared-types/src'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common'

@Controller('/system-config')
export class SystemConfigController {
  constructor(
    private readonly userService: SystemConfigUserService,
    private readonly roleService: SystemConfigRoleService,
    private readonly systemService: SystemConfigSystemService,
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
   * 获取角色列表（用于下拉选择）
   */
  @Get('role/list')
  async getRoleList(): Promise<IQueryRoleListRes> {
    return await this.userService.getRoleList()
  }

  /**
   * 获取角色管理列表（分页）
   */
  @Get('role/manage/list')
  async getRoleManageList(
    @Query('roleName') roleName?: string,
    @Query('roleKey') roleKey?: string,
    @Query('isSystemRole') isSystemRole?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryRoleManageListRes> {
    const params: IQueryRoleManageListReq = {
      roleName,
      roleKey,
      isSystemRole: isSystemRole === 'true' || isSystemRole === '1' ? true : isSystemRole === 'false' || isSystemRole === '0' ? false : undefined,
      page: page || 1,
      pageSize: pageSize || 20,
    }
    return await this.roleService.getRoleList(params)
  }

  /**
   * 创建角色
   */
  @Post('role/create')
  async createRole(
    @Body() body: ICreateRoleReq,
  ): Promise<ResponseData<ICreateRoleRes>> {
    return await this.roleService.createRole(body)
  }

  /**
   * 更新角色
   */
  @Post('role/update')
  async updateRole(
    @Body() body: IUpdateRoleReq,
  ): Promise<ResponseData<IUpdateRoleRes>> {
    return await this.roleService.updateRole(body)
  }

  /**
   * 删除角色
   */
  @Post('role/delete')
  async deleteRole(
    @Body() body: IDeleteRoleReq,
  ): Promise<ResponseData<null>> {
    return await this.roleService.deleteRole(body)
  }

  /**
   * 分配权限
   */
  @Post('role/assignPermissions')
  async assignPermissions(
    @Body() body: IAssignPermissionsReq,
  ): Promise<ResponseData<IAssignPermissionsRes>> {
    return await this.roleService.assignPermissions(body)
  }

  /**
   * 获取权限列表
   */
  @Get('permission/list')
  async getPermissionList(): Promise<IQueryPermissionListRes> {
    return await this.roleService.getPermissionList()
  }

  /**
   * 获取角色的权限ID列表
   */
  @Get('role/permissionIds')
  async getRolePermissionIds(
    @Query('roleId') roleId: number,
  ): Promise<number[]> {
    return await this.roleService.getRolePermissionIds(roleId)
  }

  /**
   * 获取角色详情
   */
  @Get('role/detail')
  async getRoleDetail(
    @Query('roleId') roleId: number,
  ): Promise<ResponseData<IRoleManageListItem>> {
    return await this.roleService.getRoleDetail(roleId)
  }

  /**
   * 启用/禁用角色
   */
  @Post('role/toggleStatus')
  async toggleRoleStatus(
    @Body() body: { roleId: number; isEnable: boolean },
  ): Promise<ResponseData<IUpdateRoleRes>> {
    return await this.roleService.toggleRoleStatus(body.roleId, body.isEnable)
  }

  // ============================================
  // 系统管理接口
  // ============================================

  /**
   * 获取系统列表
   */
  @Get('system/list')
  async getSystemList(
    @Query('systemKey') systemKey?: string,
    @Query('systemName') systemName?: string,
    @Query('isEnable') isEnable?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQuerySystemListRes> {
    const params: IQuerySystemListReq = {
      systemKey,
      systemName,
      isEnable: isEnable === 'true' || isEnable === '1' ? true : isEnable === 'false' || isEnable === '0' ? false : undefined,
      page: page || 1,
      pageSize: pageSize || 20,
    }
    return await this.systemService.getSystemList(params)
  }

  /**
   * 创建系统
   */
  @Post('system/create')
  async createSystem(
    @Body() body: ICreateSystemReq,
  ): Promise<ResponseData<ICreateSystemRes>> {
    return await this.systemService.createSystem(body)
  }

  /**
   * 更新系统
   */
  @Post('system/update')
  async updateSystem(
    @Body() body: IUpdateSystemReq,
  ): Promise<ResponseData<IUpdateSystemRes>> {
    return await this.systemService.updateSystem(body)
  }

  /**
   * 删除系统
   */
  @Post('system/delete')
  async deleteSystem(
    @Body() body: IDeleteSystemReq,
  ): Promise<ResponseData<null>> {
    return await this.systemService.deleteSystem(body)
  }

  /**
   * 获取系统选项列表（用于下拉选择）
   */
  @Get('system/options')
  async getSystemOptions(): Promise<Array<{ id: number; systemKey: string; systemName: string }>> {
    return await this.systemService.getSystemOptions()
  }
}

