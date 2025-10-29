import { Body, Controller, Get, Post, Query, UnauthorizedException } from '@nestjs/common'
import { UserService } from './user.service'
import type { IPermissionRes, IUser } from "@probe-x/shared-types/src/index"
import { User } from "@probe-x/shared-utils/src/lib/backend-common"
import { AuthService } from "@src/service/auth.service"
import { ErrorCode } from "@probe-x/shared-utils/src"

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {
  }

  @Post('login')
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.validateUser(loginDto.username, loginDto.password)
  }

  @Get('rolePermissionList')
  async rolePermissionList(@User() user: IUser): Promise<IPermissionRes> {
    // 超管特判
    if (user.userId === 1) {
      return await this.userService.getAllRoleAndPermission()
    }
    return await this.userService.getUserRoleAndPermission(user.userId)
  }

  @Get('refreshToken')
  async refreshToken(@Query('refreshToken') refreshToken: string) {
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
}
