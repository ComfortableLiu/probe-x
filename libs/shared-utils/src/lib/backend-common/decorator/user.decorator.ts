import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * JWT 令牌负载，字段与 data-dashboard-api-service 的 auth.service.ts 签发字段保持一致
 */
export interface ITokenPayload {
  // 用户唯一标识
  userId: string | number
  username: string
  // 令牌类型
  tokenType: 'refresh' | 'access'
  // 唯一 ID
  jti: string
  // 客户端标识
  clientId: string
}

/**
 * 自动从request中获取用户信息的装饰器，需要配合 SsoAuthGuard 使用
 */
export const User = createParamDecorator(
  (data: keyof ITokenPayload, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    if (!data) {
      return request.user
    }
    return request.user[data]
  },
)
