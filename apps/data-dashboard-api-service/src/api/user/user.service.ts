import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from "@nestjs/typeorm"
import { Repository, SelectQueryBuilder } from "typeorm"
import { timingSafeEqual } from "node:crypto"
import { AuthService } from "@src/service/auth.service"
import {
  Permission,
  ResponseData,
  Role,
  RolePermissionRelation,
  UserEntity,
  UserRoleRelation,
} from "@probe-x/shared-utils/src/lib/backend-common"
import { IPermissionRes, IUser } from "@probe-x/shared-types/src"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class UserService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(UserRoleRelation)
    private userRoleRepo: Repository<UserRoleRelation>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {
  }

  /**
   * 验证用户并生成JWT令牌
   * @param username
   * @param password
   */
  async validateUser(username: string, password: string) {
    if (!username?.length || !password?.length) {
      return ResponseData.error("用户名或密码不能为空")
    }
    const user = await this.userRepository.findOne({ where: { username } })

    // 检查用户是否存在且密码正确
    if (user && (this.checkPassword(password, user.passwordHash))) {
      // 生成JWT令牌
      const accessToken = this.authService.generateAccessToken(user.userId, user.username)
      // 生成刷新令牌
      const refreshToken = this.authService.generateRefreshToken(user.userId, user.username)
      return {
        accessToken,
        refreshToken,
        userInfo: {
          ...user,
          passwordHash: '*******',
        },
      }
    }

    return ResponseData.error("用户名或密码错误")
  }

  /**
   * 根据userId查询角色和权限
   */
  async getUserRoleAndPermission(userId: number): Promise<IPermissionRes> {
    const queryBuilder: SelectQueryBuilder<UserRoleRelation> = this.userRoleRepo
      .createQueryBuilder('user_role')
      // 关联角色表：user_role → role
      .leftJoinAndSelect(() => UserRoleRelation.prototype.role, 'role')
      // .leftJoinAndSelect('user_role.role', 'role')

      // 关联角色-权限关联表：role → role_permission
      .leftJoinAndSelect(() => Role.prototype.permissionRelations, 'role_permission')
      // .leftJoinAndSelect('role.permissionRelations', 'role_permission')

      // 关联权限表：role_permission → permission
      .leftJoinAndSelect(() => RolePermissionRelation.prototype.permission, 'permission')
      // .leftJoinAndSelect('role_permission.permission', 'permission')

      // 筛选条件：指定用户ID
      .where('user_role.user_id = :userId', { userId })
      // 只查询启用的权限（提前过滤，减少后续处理）
      .andWhere('permission.is_enable = 1')
    const relations = await queryBuilder.getMany()

    // 7. 格式化结果
    const roles = relations.map(rel => ({
      id: rel.role.id,
      roleName: rel.role.roleName,
      roleKey: rel.role.roleKey,
      permissions: rel.role.permissionRelations.map(rpr => ({
        id: rpr.permission.id,
        permissionKey: rpr.permission.permissionKey,
        permissionName: rpr.permission.permissionName,
      })),
    }))

    // 8. 提取所有权限（去重）
    const allPermissions = roles
      .flatMap(role => role.permissions)
      .filter((v, i, a) => a.findIndex(p => p.permissionKey === v.permissionKey) === i)

    return { roles, allPermissions }
  }

  /**
   * 获取所有的角色和权限
   */
  async getAllRoleAndPermission(): Promise<IPermissionRes> {
    return {
      roles: await this.roleRepo.find(),
      allPermissions: await this.permissionRepo.find(),
    }
  }

  /**
   * 验证SSO token
   * @param token
   */
  async validateSsoToken(token: string): Promise<IUser> {
    const secret = this.configService.get<string>('jwt.secret')
    try {
      // 验证JWT token
      const decoded = await this.jwtService.verifyAsync(token, { secret })

      // 根据username查找用户
      const user = await this.userRepository.findOne({
        where: { username: decoded.username },
      })

      // 检查用户是否存在
      if (user) {
        return {
          ...user,
          passwordHash: '*******',
        }
      }

      return null
    } catch (error) {
      // token验证失败
      console.error('e', error)
      return null
    }
  }

  /**
   * 验证密码
   * @param password 明文密码
   * @param hash 密码哈希值
   * @returns 密码是否匹配
   */
  private checkPassword(password: string, hash: string): boolean {
    // 使用bcrypt比较密码
    return this.safeCompare(password, hash)
  }

  private safeCompare(a: string, b: string): boolean {
    const bufferA = Buffer.from(a)
    const bufferB = Buffer.from(b)
    return bufferA.length === bufferB.length &&
      timingSafeEqual(bufferA, bufferB)
  }
}
