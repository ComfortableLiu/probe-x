import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common'
import { UserService } from './user.service'
import type { IPermissionRes, IUser, IUpdateUserProfileReq, IUpdateUserProfileRes, IChangePasswordReq, IChangePasswordRes } from "@probe-x/shared-types/src/index"
import { User, ResponseData } from "@probe-x/shared-utils/src/lib/backend-common"
import { AuthService } from "@src/service/auth.service"
import { ErrorCode } from "@probe-x/shared-utils/src"
import { JwtAuthGuard } from "./JwtAuthGuard"
import { LoginThrottleGuard } from "../../guard/throttle.guard"
import { AdminGuard } from "../../guard/admin.guard"

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {
  }

  @Post('login')
  @UseGuards(LoginThrottleGuard)
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.validateUser(loginDto.username, loginDto.password)
  }

  @Get('rolePermissionList')
  @UseGuards(JwtAuthGuard)
  async rolePermissionList(@User() user: IUser): Promise<IPermissionRes> {
    // 超管特判：检查用户是否拥有 admin 角色
    const userRoles = await this.userService.getUserRoles(user.userId)
    const isAdmin = userRoles.some(role => role.roleKey === 'admin' || role.roleKey === 'super_admin' || role.roleType === 'system')
    if (isAdmin) {
      return await this.userService.getAllRoleAndPermission()
    }
    return await this.userService.getUserRoleAndPermission(user.userId)
  }

  @Post('refreshToken')
  async refreshToken(@Body() body: { refreshToken: string }) {
    const refreshToken = body?.refreshToken
    if (!refreshToken) {
      throw new UnauthorizedException({
        message: 'refreshToken不能为空',
        code: ErrorCode.REFRESH_TOKEN_EXPIRED,
      })
    }
    const userInfo = await this.userService.validateSsoToken(refreshToken)
    if (!userInfo){
      throw new UnauthorizedException({
        message: 'refreshToken令牌无效或已过期',
        code: ErrorCode.REFRESH_TOKEN_EXPIRED,
      })
    }
    const newAccessToken = this.authService.generateAccessToken(userInfo.userId, userInfo.username)
    // 这里也重新生成一个新的刷新token的目的是为了提升体验，让频繁使用系统的用户无感去刷新token。
    // 也就是变成了，只要7天内访问过系统，就可以不用登录，而7天内没有访问系统的用户，则需要重新登录
    const newRefreshToken = this.authService.generateRefreshToken(userInfo.userId, userInfo.username)
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      userInfo,
    }
  }

  /**
   * 获取当前用户信息
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@User() user: IUser): Promise<ResponseData<IUser & { hasPassword: boolean }>> {
    return await this.userService.getCurrentUser(user.userId!)
  }

  /**
   * 更新用户个人信息
   */
  @Post('profile/update')
  @UseGuards(JwtAuthGuard)
  async updateUserProfile(
    @User() user: IUser,
    @Body() body: IUpdateUserProfileReq,
  ): Promise<ResponseData<IUpdateUserProfileRes>> {
    return await this.userService.updateUserProfile(user.userId!, body)
  }

  /**
   * 重置admin密码（仅开发环境可用，且需要管理员权限）
   */
  @Post('admin/reset-password')
  @UseGuards(AdminGuard)
  async resetAdminPassword() {
    return this.userService.resetAdminPassword()
  }

  /**
   * 修改密码
   */
  @Post('changePassword')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @User() user: IUser,
    @Body() body: IChangePasswordReq,
  ): Promise<ResponseData<IChangePasswordRes>> {
    return await this.userService.changePassword(user.userId!, body.oldPassword || null, body.newPassword)
  }
}
