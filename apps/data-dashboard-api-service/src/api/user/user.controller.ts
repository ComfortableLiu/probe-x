import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { UserService } from './user.service'

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {
  }

  @Post('login')
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.validateUser(loginDto.username, loginDto.password)
  }

  @Get('refresh-token')
  async refreshToken(@Query('refreshToken') refreshToken: string) {
    return await this.userService.generateJwtToken(await this.userService.validateSsoToken(refreshToken))
  }
}
