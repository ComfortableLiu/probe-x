import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { IUser } from "@probe-x/shared-types/src"

/**
 * 自动从request中获取用户信息的装饰器，需要配合
 */
export const User = createParamDecorator(
  (data: keyof IUser, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    if (!data) {
      return request.user
    }
    return request.user[data]
  },
)
