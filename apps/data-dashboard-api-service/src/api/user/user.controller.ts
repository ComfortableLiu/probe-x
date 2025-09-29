import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common'
import { UserService } from './user.service'
import { Request, Response } from 'express'

@Controller('/user')
export class UserController {
  constructor(private readonly userService: UserService) {
  }

  @Get('/getUserByToken')
  @HttpCode(200)
  async getUserByToken(@Query('accessToken') accessToken: string) {
    return 'fwefqwef--:' + accessToken
  }

  @Post('/login')
  @HttpCode(200)
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.validateUser(loginDto.username, loginDto.password)
  }

  @Get('/sso-login')
  async ssoLogin(@Query('token') token: string, @Req() req: Request, @Res() res: Response) {
    // 验证SSO token
    const user = await this.userService.validateSsoToken(token)

    if (user) {
      // 生成本地JWT token
      const localToken = await this.userService.generateJwtToken(user)
      // 重定向到前端应用，并携带token
      return res
        .status(200)
        .json({
          token: localToken,
        })
    } else {
      return res.status(401).json({ message: 'SSO验证失败' })
    }
  }
}
