import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Role, UserEntity, UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectRepository(UserRoleRelation)
    private userRoleRepo: Repository<UserRoleRelation>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    if (!user?.userId) {
      throw new ForbiddenException('未认证')
    }

    // 查询用户的角色
    const userRoles = await this.userRoleRepo.find({
      where: { userId: user.userId },
    })
    const roleIds = userRoles.map(ur => ur.roleId)
    if (roleIds.length === 0) {
      throw new ForbiddenException('无管理员权限')
    }

    const roles = await this.roleRepo.findByIds(roleIds)
    const isAdmin = roles.some(role => role.roleKey === 'admin' || role.isSystemRole)
    if (!isAdmin) {
      throw new ForbiddenException('无管理员权限')
    }

    return true
  }
}
