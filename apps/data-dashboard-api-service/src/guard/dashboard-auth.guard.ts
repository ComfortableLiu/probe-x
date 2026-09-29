import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { SsoAuthGuard } from '@probe-x/shared-utils/src/lib/backend-common'
import { ErrorCode } from '@probe-x/shared-utils/src'
import { UserService } from '../api/user/user.service'

@Injectable()
export class DashboardAuthGuard extends SsoAuthGuard {
  constructor(jwtService: JwtService, private readonly userService: UserService) {
    super(jwtService)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context)
    const request = context.switchToHttp().getRequest()
    // 登录及刷新路由由各自的处理器校验凭证。
    if (!request.user) return true
    if (!(await this.userService.validateSession(request.user))) {
      throw new UnauthorizedException({ message: '账号已停用或会话已失效，请重新登录', code: ErrorCode.TOKEN_EXPIRED })
    }
    return true
  }
}
