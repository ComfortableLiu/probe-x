import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from "@nestjs/jwt"
import { Request } from "express"
import { ErrorCode } from "@probe-x/shared-utils/src"

/**
 * 用于SSO认证的守卫
 */
@Injectable()
export class SsoAuthGuard implements CanActivate {

  constructor(private jwtService: JwtService) {
  }

  // 白名单
  private readonly whiteList = [
    '/api/user/login',
    '/api/user/refreshToken',
  ]

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    if (this.whiteList.includes(request.path)) {
      return true
    }

    // 1. 从请求头中提取 JWT 令牌（格式：Bearer <token>）
    const token = this.extractTokenFromHeader(request)
    if (!token) {
      throw new UnauthorizedException({
        message: '未提供令牌',
        code: ErrorCode.TOKEN_EXPIRED,
      })
    }

    try {
      // 2. 验证并解析令牌（使用全局配置的密钥）
      // payload 包含 JWT 中存储的用户信息（如 userId、username 等）
      const payload = await this.jwtService.verifyAsync(token)

      // 3. 将用户信息注入到 request 对象中，供后续接口使用
      // @ts-ignore
      request.user = payload
    } catch (error) {
      throw new UnauthorizedException({
        message: '令牌无效或已过期',
        code: ErrorCode.TOKEN_EXPIRED,
      })
    }

    return true // 允许请求继续进入业务接口
  }

  // 从请求头提取令牌的工具方法
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
