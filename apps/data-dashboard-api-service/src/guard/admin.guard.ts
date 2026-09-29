import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common'
import { AuthorizationService } from '../service/authorization.service'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authorizationService: AuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    if (!user?.userId) {
      throw new ForbiddenException('未认证')
    }

    if (!(await this.authorizationService.isAdmin(user.userId))) {
      throw new ForbiddenException('无管理员权限')
    }

    return true
  }
}
