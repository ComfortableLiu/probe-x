import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Role, UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common'

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(UserRoleRelation)
    private readonly userRoleRepository: Repository<UserRoleRelation>,
  ) {}

  async getGlobalRoles(userId: number): Promise<Role[]> {
    const assignments = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role', 'role.permissionRelations', 'role.permissionRelations.permission'],
    })
    // 系统内角色不能授予全局管理能力；停用角色立即失效。
    return assignments
      .filter(assignment => assignment.systemId == null && assignment.role?.systemId == null && Number(assignment.role?.isEnable) === 1)
      .map(assignment => assignment.role)
  }

  async isAdmin(userId: number): Promise<boolean> {
    return (await this.getGlobalRoles(userId)).some(role => role.roleKey === 'admin' || role.roleKey === 'super_admin')
  }

  async hasPermissions(userId: number, permissionKeys: string[]): Promise<boolean> {
    const roles = await this.getGlobalRoles(userId)
    if (roles.some(role => role.roleKey === 'admin' || role.roleKey === 'super_admin')) {
      return true
    }
    const granted = new Set(roles.flatMap(role => (role.permissionRelations || [])
      .filter(relation => Number(relation.permission?.isEnable) === 1 && relation.permission?.systemId == null)
      .map(relation => relation.permission.permissionKey)))
    return permissionKeys.every(key => granted.has(key))
  }
}
