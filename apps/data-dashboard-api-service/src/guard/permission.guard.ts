import { applyDecorators, CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UseGuards } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthorizationService } from '../service/authorization.service'

const REQUIRED_PERMISSIONS = 'probe-x:required-permissions'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()])
    const userId = context.switchToHttp().getRequest().user?.userId
    if (!userId || !permissions?.length || !(await this.authorizationService.hasPermissions(userId, permissions))) {
      throw new ForbiddenException('无操作权限')
    }
    return true
  }
}

export const RequirePermissions = (...permissionKeys: string[]) => applyDecorators(
  SetMetadata(REQUIRED_PERMISSIONS, permissionKeys),
  UseGuards(PermissionGuard),
)
