import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { UserService } from './user.service'
import type { IPermissionRes, IUser } from "@probe-x/shared-types/src/index"
import { User } from "@probe-x/shared-utils/src/lib/backend-common"

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {
  }

  @Post('login')
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.validateUser(loginDto.username, loginDto.password)
  }

  @Get('rolePermissionList')
  async rolePermissionList(@User() user: IUser): Promise<IPermissionRes> {
    return await this.userService.getUserRoleAndPermission(user.userId)
  }

  @Get('refresh-token')
  async refreshToken(@Query('refreshToken') refreshToken: string) {
    return await this.userService.generateJwtToken(await this.userService.validateSsoToken(refreshToken))
  }
}
