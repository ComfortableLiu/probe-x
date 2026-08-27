import { ExtractJwt, Strategy } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type JwtPayload = {
  userId: number;
  username: string;
  tokenType: 'refresh' | 'access';
};

/**
 * 用于验证JWT令牌的策略
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('jwt.secret')
    if (!secret) {
      throw new Error('JWT_SECRET 环境变量未配置，服务无法启动')
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  async validate(payload: JwtPayload) {
    return { userId: payload.userId, username: payload.username }
  }
}
