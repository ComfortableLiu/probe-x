import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import {
  Permission,
  ResponseData,
  Role,
  RolePermissionRelation,
  UserRoleRelation,
} from '@probe-x/shared-utils/src/lib/backend-common'
import {
  IAssignPermissionsReq,
  IAssignPermissionsRes,
  ICreateRoleReq,
  ICreateRoleRes,
  IDeleteRoleReq,
  IPermissionOption,
  IQueryPermissionListRes,
  IQueryRoleManageListReq,
  IQueryRoleManageListRes,
  IRoleManageListItem,
  IUpdateRoleReq,
  IUpdateRoleRes,
} from '@probe-x/shared-types/src'

/**
 * 系统角色标识
 */
export const SYSTEM_ROLE_KEYS = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  DATA_ANALYST: 'data_analyst',
}

@Injectable()
export class SystemConfigRoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermissionRelation)
    private rolePermissionRepo: Repository<RolePermissionRelation>,
    @InjectRepository(UserRoleRelation)
    private userRoleRepo: Repository<UserRoleRelation>,
  ) {
  }

  /**
   * 获取角色列表（分页）
   */
  async getRoleList(params: IQueryRoleManageListReq): Promise<IQueryRoleManageListRes> {
    const { roleName, roleKey, isSystemRole, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const queryBuilder = this.roleRepo
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissionRelations', 'permissionRelations')
      .leftJoinAndSelect('permissionRelations.permission', 'permission')
      .leftJoinAndSelect('role.userRelations', 'userRelations')

    // 添加筛选条件
    if (roleName) {
      queryBuilder.andWhere('role.roleName LIKE :roleName', {
        roleName: `%${roleName}%`,
      })
    }
    if (roleKey) {
      queryBuilder.andWhere('role.roleKey LIKE :roleKey', {
        roleKey: `%${roleKey}%`,
      })
    }
    if (isSystemRole !== undefined) {
      // 判断是否为系统角色：roleKey 在系统角色列表中
      const systemRoleKeys = Object.values(SYSTEM_ROLE_KEYS)
      if (isSystemRole) {
        queryBuilder.andWhere('role.roleKey IN (:...systemRoleKeys)', { systemRoleKeys })
      } else {
        queryBuilder.andWhere('role.roleKey NOT IN (:...systemRoleKeys)', { systemRoleKeys })
      }
    }

    // 获取总数
    const total = await queryBuilder.getCount()

    // 分页查询
    const roles = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('role.createdAt', 'DESC')
      .getMany()

    // 格式化返回数据
    const data: IRoleManageListItem[] = roles.map((role) => {
      const isSystemRole = Object.values(SYSTEM_ROLE_KEYS).includes(role.roleKey as any)
      // 只统计启用的权限
      const permissionCount = role.permissionRelations?.filter(
        rel => rel.permission?.isEnable !== 0,
      ).length || 0
      const userCount = role.userRelations?.length || 0

      return {
        id: role.id!,
        roleKey: role.roleKey!,
        roleName: role.roleName!,
        description: role.description,
        isSystemRole,
        isEnable: role.isEnable !== 0,
        permissionCount,
        userCount,
        createTime: role.createdAt,
        updateTime: role.updatedAt,
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
   * 创建角色
   */
  async createRole(data: ICreateRoleReq): Promise<ResponseData<ICreateRoleRes>> {
    const { roleKey, roleName, description, permissionIds = [] } = data

    // 验证必填字段
    if (!roleKey || !roleName) {
      return ResponseData.error('角色标识和角色名称不能为空')
    }

    // 验证角色标识格式（只能包含小写字母、数字和下划线）
    if (!/^[a-z0-9_]+$/.test(roleKey)) {
      return ResponseData.error('角色标识只能包含小写字母、数字和下划线')
    }

    // 检查角色标识是否已存在
    const existingRoleByKey = await this.roleRepo.findOne({
      where: { roleKey },
    })
    if (existingRoleByKey) {
      return ResponseData.error('角色标识已存在')
    }

    // 检查角色名称是否已存在
    const existingRoleByName = await this.roleRepo.findOne({
      where: { roleName },
    })
    if (existingRoleByName) {
      return ResponseData.error('角色名称已存在')
    }

    // 检查是否为系统角色
    const isSystemRole = Object.values(SYSTEM_ROLE_KEYS).includes(roleKey as any)
    if (isSystemRole) {
      return ResponseData.error('不能创建系统角色，系统角色已预定义')
    }

    // 创建角色
    const role = this.roleRepo.create({
      roleKey,
      roleName,
      description,
      isEnable: 1,
    })

    const savedRole = await this.roleRepo.save(role)

    // 分配权限
    if (permissionIds.length > 0) {
      // 验证权限是否存在
      const permissions = await this.permissionRepo.find({
        where: { id: In(permissionIds) },
      })
      if (permissions.length !== permissionIds.length) {
        // 即使权限验证失败，角色已创建，返回成功但记录警告
        console.warn(`角色创建成功，但部分权限不存在: ${permissionIds.filter(id => !permissions.find(p => p.id === id))}`)
      }
      // 只分配存在的权限
      const validPermissionIds = permissions.map(p => p.id!).filter(Boolean) as number[]
      if (validPermissionIds.length > 0) {
        await this.assignPermissionsToRole(savedRole.id!, validPermissionIds)
      }
    }

    const result: ICreateRoleRes = {
      id: savedRole.id!,
      roleKey: savedRole.roleKey!,
      roleName: savedRole.roleName!,
      description: savedRole.description,
    }
    return ResponseData.success(result)
  }

  /**
   * 更新角色
   */
  async updateRole(data: IUpdateRoleReq): Promise<ResponseData<IUpdateRoleRes>> {
    const { id, roleName, description, isEnable, permissionIds } = data

    const role = await this.roleRepo.findOne({
      where: { id },
    })

    if (!role) {
      return ResponseData.error('角色不存在')
    }

    // 检查是否为系统角色
    const isSystemRole = Object.values(SYSTEM_ROLE_KEYS).includes(role.roleKey as any)
    if (isSystemRole) {
      // 系统角色中，超管不可编辑
      if (role.roleKey === SYSTEM_ROLE_KEYS.SUPER_ADMIN) {
        return ResponseData.error('超管角色不可编辑')
      }
      // 其他系统角色只能更新描述
      if (roleName !== undefined || isEnable !== undefined || permissionIds !== undefined) {
        return ResponseData.error('系统角色只能更新描述')
      }
    }

    // 验证角色名称是否重复（排除当前角色）
    if (roleName !== undefined && roleName !== role.roleName) {
      const existingRole = await this.roleRepo.findOne({
        where: { roleName },
      })
      if (existingRole && existingRole.id !== id) {
        return ResponseData.error('角色名称已存在')
      }
    }

    if (roleName !== undefined) {
      role.roleName = roleName
    }
    if (description !== undefined) {
      role.description = description
    }
    if (isEnable !== undefined) {
      // 系统角色不可禁用
      if (isSystemRole && !isEnable) {
        return ResponseData.error('系统角色不可禁用')
      }
      role.isEnable = isEnable ? 1 : 0
    }

    await this.roleRepo.save(role)

    // 更新权限
    if (permissionIds !== undefined) {
      // 系统角色不允许通过此接口修改权限
      if (isSystemRole) {
        return ResponseData.error('系统角色的权限由系统配置决定，无法手动修改')
      }
      // 删除旧的权限关联
      await this.rolePermissionRepo.delete({ roleId: id })
      // 添加新的权限关联
      if (permissionIds.length > 0) {
        await this.assignPermissionsToRole(id, permissionIds)
      }
    }

    const result: IUpdateRoleRes = {
      id: role.id!,
      roleKey: role.roleKey!,
      roleName: role.roleName!,
      description: role.description,
      isEnable: role.isEnable !== 0,
    }
    return ResponseData.success(result)
  }

  /**
   * 删除角色
   */
  async deleteRole(data: IDeleteRoleReq): Promise<ResponseData<null>> {
    const { id } = data

    const role = await this.roleRepo.findOne({
      where: { id },
    })

    if (!role) {
      return ResponseData.error('角色不存在')
    }

    // 检查是否为系统角色
    const isSystemRole = Object.values(SYSTEM_ROLE_KEYS).includes(role.roleKey as any)
    if (isSystemRole) {
      return ResponseData.error('系统角色不可删除')
    }

    // 检查是否有用户使用该角色
    const userCount = await this.userRoleRepo.count({
      where: { roleId: id },
    })
    if (userCount > 0) {
      return ResponseData.error(`该角色已被 ${userCount} 个用户使用，无法删除`)
    }

    // 删除角色（级联删除会同时删除权限关联）
    await this.roleRepo.remove(role)

    return ResponseData.success(null)
  }

  /**
   * 分配权限
   */
  async assignPermissions(data: IAssignPermissionsReq): Promise<ResponseData<IAssignPermissionsRes>> {
    const { roleId, permissionIds } = data

    if (!Array.isArray(permissionIds)) {
      return ResponseData.error('权限ID列表格式错误')
    }

    const role = await this.roleRepo.findOne({
      where: { id: roleId },
    })

    if (!role) {
      return ResponseData.error('角色不存在')
    }

    // 检查是否为系统角色
    const isSystemRole = Object.values(SYSTEM_ROLE_KEYS).includes(role.roleKey as any)
    if (isSystemRole) {
      // 超管角色拥有所有权限，无需分配
      if (role.roleKey === SYSTEM_ROLE_KEYS.SUPER_ADMIN) {
        return ResponseData.error('超管角色拥有所有权限，无需分配')
      }
      // 其他系统角色的权限由系统配置决定，不允许手动修改
      return ResponseData.error('系统角色的权限由系统配置决定，无法手动修改')
    }

    // 验证权限是否存在
    if (permissionIds.length > 0) {
      // 去重
      const uniquePermissionIds = [...new Set(permissionIds)]
      const permissions = await this.permissionRepo.find({
        where: { id: In(uniquePermissionIds), isEnable: 1 },
      })

      if (permissions.length !== uniquePermissionIds.length) {
        const missingIds = uniquePermissionIds.filter(id => !permissions.find(p => p.id === id))
        return ResponseData.error(`部分权限不存在或已禁用: ${missingIds.join(', ')}`)
      }
    }

    // 删除旧的权限关联
    await this.rolePermissionRepo.delete({ roleId })

    // 添加新的权限关联
    if (permissionIds.length > 0) {
      // 使用去重后的权限ID
      const uniquePermissionIds = [...new Set(permissionIds)]
      await this.assignPermissionsToRole(roleId, uniquePermissionIds)
    }

    const result: IAssignPermissionsRes = {
      roleId,
      permissionIds: permissionIds.length > 0 ? [...new Set(permissionIds)] : [],
    }
    return ResponseData.success(result)
  }

  /**
   * 获取权限列表
   */
  async getPermissionList(): Promise<IQueryPermissionListRes> {
    const permissions = await this.permissionRepo.find({
      where: { isEnable: 1 },
      order: { createdAt: 'ASC' },
    })

    const data: IPermissionOption[] = permissions.map((permission) => ({
      id: permission.id!,
      permissionKey: permission.permissionKey!,
      permissionName: permission.permissionName!,
      description: permission.description,
    }))

    return { data }
  }

  /**
   * 获取角色的权限ID列表
   */
  async getRolePermissionIds(roleId: number): Promise<number[]> {
    const relations = await this.rolePermissionRepo.find({
      where: { roleId },
    })

    return relations.map((rel) => rel.permissionId!)
  }

  /**
   * 获取角色详情（包含权限信息）
   */
  async getRoleDetail(roleId: number): Promise<ResponseData<IRoleManageListItem>> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['permissionRelations', 'permissionRelations.permission', 'userRelations'],
    })

    if (!role) {
      return ResponseData.error('角色不存在')
    }

    const isSystemRole = Object.values(SYSTEM_ROLE_KEYS).includes(role.roleKey as any)
    const permissionCount = role.permissionRelations?.length || 0
    const userCount = role.userRelations?.length || 0

    const result: IRoleManageListItem = {
      id: role.id!,
      roleKey: role.roleKey!,
      roleName: role.roleName!,
      description: role.description,
      isSystemRole,
      isEnable: role.isEnable !== 0,
      permissionCount,
      userCount,
      createTime: role.createdAt,
      updateTime: role.updatedAt,
    }

    return ResponseData.success(result)
  }

  /**
   * 初始化系统角色（确保系统角色存在）
   */
  async initSystemRoles(): Promise<void> {
    const systemRoles = [
      {
        roleKey: SYSTEM_ROLE_KEYS.SUPER_ADMIN,
        roleName: '超管',
        description: '系统超级管理员，拥有所有权限，唯一账号为admin，无法进行任何新增或删除操作',
      },
      {
        roleKey: SYSTEM_ROLE_KEYS.ADMIN,
        roleName: '管理员',
        description: '系统管理员，拥有除了管理超管角色以外的所有权限',
      },
      {
        roleKey: SYSTEM_ROLE_KEYS.DEVELOPER,
        roleName: '研发',
        description: '研发人员角色，拥有开发和配置相关权限',
      },
      {
        roleKey: SYSTEM_ROLE_KEYS.DATA_ANALYST,
        roleName: '数据分析师',
        description: '数据分析师角色，拥有数据分析和查看相关权限',
      },
    ]

    for (const systemRole of systemRoles) {
      const existingRole = await this.roleRepo.findOne({
        where: { roleKey: systemRole.roleKey },
      })

      if (!existingRole) {
        const role = this.roleRepo.create({
          roleKey: systemRole.roleKey,
          roleName: systemRole.roleName,
          description: systemRole.description,
          isEnable: 1,
        })
        await this.roleRepo.save(role)
      } else {
        // 更新系统角色的名称和描述（如果数据库中的不一致）
        if (existingRole.roleName !== systemRole.roleName || existingRole.description !== systemRole.description) {
          existingRole.roleName = systemRole.roleName
          existingRole.description = systemRole.description
          await this.roleRepo.save(existingRole)
        }
      }
    }
  }

  /**
   * 启用/禁用角色
   */
  async toggleRoleStatus(roleId: number, isEnable: boolean): Promise<ResponseData<IUpdateRoleRes>> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
    })

    if (!role) {
      return ResponseData.error('角色不存在')
    }

    // 系统角色不可禁用
    const isSystemRole = Object.values(SYSTEM_ROLE_KEYS).includes(role.roleKey as any)
    if (isSystemRole && !isEnable) {
      return ResponseData.error('系统角色不可禁用')
    }

    role.isEnable = isEnable ? 1 : 0
    await this.roleRepo.save(role)

    const result: IUpdateRoleRes = {
      id: role.id!,
      roleKey: role.roleKey!,
      roleName: role.roleName!,
      description: role.description,
      isEnable: role.isEnable !== 0,
    }
    return ResponseData.success(result)
  }

  /**
   * 为角色分配权限（内部方法）
   */
  private async assignPermissionsToRole(roleId: number, permissionIds: number[]): Promise<void> {
    const relations = permissionIds.map((permissionId) =>
      this.rolePermissionRepo.create({
        roleId,
        permissionId,
      }),
    )

    await this.rolePermissionRepo.save(relations)
  }
}

