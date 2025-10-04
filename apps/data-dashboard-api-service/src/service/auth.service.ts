import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuidv4 } from 'uuid' // 需要安装 uuid 包
import { ConfigService } from "@nestjs/config"
import { ITokenPayload } from "@src/service/auth.service.type"

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
  }

  secret = this.configService.get<string>('jwt.secret') || ''

  // 生成刷新令牌
  generateRefreshToken(userId: number, username: string, clientId: string = 'probe-x') {
    const expiresIn = +this.configService.get<string>('jwt.refreshExpiresIn')
    const payload: ITokenPayload = {
      userId,
      username,
      tokenType: 'refresh',
      jti: uuidv4(),
      clientId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    }

    return this.jwtService.sign(payload, { secret: this.secret })
  }

  // 生成登录用的 Access Token
  generateAccessToken(userId: number, username: string, clientId: string = 'probe-x') {
    const expiresIn = +this.configService.get<string>('jwt.expiresIn')
    const payload: ITokenPayload = {
      userId,
      username,
      tokenType: 'access',
      clientId,
      jti: uuidv4(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    }

    return this.jwtService.sign(payload, { secret: this.secret })
  }
}
