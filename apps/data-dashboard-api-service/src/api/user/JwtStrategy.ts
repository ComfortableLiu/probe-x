import { ExtractJwt, Strategy } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type JwtPayload = {
  sub: number;
  username: string;
};

/**
 * 用于验证JWT令牌的策略
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || '',
    })
  }

  async validate(payload: JwtPayload) {
    return { userId: payload.sub, username: payload.username }
  }
}
