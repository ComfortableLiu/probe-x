import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import {
  ResponseData,
  Role,
  UserEntity,
  UserRoleRelation,
} from '@probe-x/shared-utils/src/lib/backend-common'
import {
  IQueryUserListReq,
  IQueryUserListRes,
  IUserListItem,
  ICreateUserReq,
  ICreateUserRes,
  IUpdateUserReq,
  IUpdateUserRes,
  IResetPasswordReq,
  IResetPasswordRes,
  IAssignRolesReq,
  IAssignRolesRes,
  IQueryRoleListRes,
} from '@probe-x/shared-types/src'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'

@Injectable()
export class SystemConfigUserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(UserRoleRelation)
    private userRoleRepo: Repository<UserRoleRelation>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private configService: ConfigService,
  ) {}

  /**
   * 获取用户列表（分页）
   */
  async getUserList(params: IQueryUserListReq): Promise<IQueryUserListRes> {
    const { username, email, isActive, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roleRelations', 'roleRelations')
      .leftJoinAndSelect('roleRelations.role', 'role')

    // 添加筛选条件
    if (username) {
      queryBuilder.andWhere('user.username LIKE :username', {
        username: `%${username}%`,
      })
    }
    if (email) {
      queryBuilder.andWhere('user.email LIKE :email', {
        email: `%${email}%`,
      })
    }
    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive })
    }

    // 获取总数
    const total = await queryBuilder.getCount()

    // 分页查询
    const users = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('user.createdAt', 'DESC')
      .getMany()

    // 格式化返回数据
    const data: IUserListItem[] = users.map((user) => {
      const roles = user.roleRelations?.map((rel) => rel.role?.roleName).filter(Boolean) as string[] || []
      const roleIds = user.roleRelations?.map((rel) => rel.role?.id).filter(Boolean) as number[] || []

      return {
        userId: user.userId!,
        username: user.username!,
        email: user.email,
        nickname: user.nickname,
        isActive: user.isActive !== false,
        lastLogin: user.lastLogin,
        createTime: user.createdAt,
        updateTime: user.updatedAt,
        roles,
        roleIds,
      }
    })

    return {
      data,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 创建用户
   */
  async createUser(data: ICreateUserReq): Promise<ResponseData<ICreateUserRes>> {
    const { username, password, email, nickname, isActive = true, roleIds = [] } = data

    // 检查用户名是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { username },
    })
    if (existingUser) {
      return ResponseData.error('用户名已存在')
    }

    // 检查邮箱是否已存在
    if (email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email },
      })
      if (existingEmail) {
        return ResponseData.error('邮箱已存在')
      }
    }

    // 加密密码（使用简单的哈希，实际应该使用 bcrypt）
    const passwordHash = this.hashPassword(password)

    // 创建用户
    const user = this.userRepository.create({
      username,
      passwordHash,
      email,
      nickname,
      isActive,
    })

    const savedUser = await this.userRepository.save(user)

    // 分配角色
    if (roleIds.length > 0) {
      await this.assignRolesToUser(savedUser.userId!, roleIds)
    }

    const result: ICreateUserRes = {
      userId: savedUser.userId!,
      username: savedUser.username!,
      email: savedUser.email,
      nickname: savedUser.nickname,
      isActive: savedUser.isActive !== false,
    }
    return ResponseData.success(result)
  }

  /**
   * 更新用户
   */
  async updateUser(data: IUpdateUserReq): Promise<ResponseData<IUpdateUserRes>> {
    const { userId, email, nickname, isActive, roleIds } = data

    const user = await this.userRepository.findOne({
      where: { userId },
    })

    if (!user) {
      return ResponseData.error('用户不存在')
    }

    // 检查邮箱是否被其他用户使用
    if (email && email !== user.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email },
      })
      if (existingEmail) {
        return ResponseData.error('邮箱已被其他用户使用')
      }
      user.email = email
    }

    if (nickname !== undefined) {
      user.nickname = nickname
    }
    if (isActive !== undefined) {
      user.isActive = isActive
    }

    await this.userRepository.save(user)

    // 更新角色
    if (roleIds !== undefined) {
      // 删除旧的角色关联
      await this.userRoleRepo.delete({ userId })
      // 添加新的角色关联
      if (roleIds.length > 0) {
        await this.assignRolesToUser(userId, roleIds)
      }
    }

    const result: IUpdateUserRes = {
      userId: user.userId!,
      username: user.username!,
      email: user.email,
      nickname: user.nickname,
      isActive: user.isActive !== false,
    }
    return ResponseData.success(result)
  }

  /**
   * 删除用户
   */
  async deleteUser(userId: number): Promise<ResponseData<null>> {
    const user = await this.userRepository.findOne({
      where: { userId },
    })

    if (!user) {
      return ResponseData.error('用户不存在')
    }

    // 删除用户（级联删除会同时删除角色关联）
    await this.userRepository.remove(user)

    return ResponseData.success(null)
  }

  /**
   * 重置密码
   */
  async resetPassword(userId: number, newPassword: string): Promise<ResponseData<IResetPasswordRes>> {
    const user = await this.userRepository.findOne({
      where: { userId },
    })

    if (!user) {
      return ResponseData.error('用户不存在')
    }

    // 加密新密码
    user.passwordHash = this.hashPassword(newPassword)
    await this.userRepository.save(user)

    const result: IResetPasswordRes = {
      userId: user.userId!,
    }
    return ResponseData.success(result)
  }

  /**
   * 分配角色
   */
  async assignRoles(userId: number, roleIds: number[]): Promise<ResponseData<IAssignRolesRes>> {
    const user = await this.userRepository.findOne({
      where: { userId },
    })

    if (!user) {
      return ResponseData.error('用户不存在')
    }

    // 验证角色是否存在
    if (roleIds.length > 0) {
      const roles = await this.roleRepo.find({
        where: { id: In(roleIds) },
      })
      if (roles.length !== roleIds.length) {
        return ResponseData.error('部分角色不存在')
      }
    }

    // 删除旧的角色关联
    await this.userRoleRepo.delete({ userId })

    // 添加新的角色关联
    if (roleIds.length > 0) {
      await this.assignRolesToUser(userId, roleIds)
    }

    const result: IAssignRolesRes = {
      userId,
      roleIds,
    }
    return ResponseData.success(result)
  }

  /**
   * 获取角色列表
   */
  async getRoleList(): Promise<IQueryRoleListRes> {
    const roles = await this.roleRepo.find({
      where: { isEnable: 1 },
      order: { createdAt: 'ASC' },
    })

    return roles.map((role) => ({
      id: role.id,
      roleName: role.roleName,
      roleKey: role.roleKey,
    }))
  }

  /**
   * 为用户分配角色（内部方法）
   */
  private async assignRolesToUser(userId: number, roleIds: number[]): Promise<void> {
    const relations = roleIds.map((roleId) =>
      this.userRoleRepo.create({
        userId,
        roleId,
      }),
    )

    await this.userRoleRepo.save(relations)
  }

  /**
   * 密码加密（使用与登录相同的 HMAC-SHA512 加密方式）
   */
  private hashPassword(password: string): string {
    const salt = this.configService.get<string>('login.salt') || ''
    const secret = this.configService.get<string>('login.secret') || ''
    // 使用与前端登录相同的加密方式：HMAC-SHA512
    const hmac = crypto.createHmac('sha512', secret)
    hmac.update(password + salt)
    return hmac.digest('hex')
  }
}

