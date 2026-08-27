import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, In, Repository } from 'typeorm'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common/entity/response.entity'
import { Permission } from '@probe-x/shared-utils/src/lib/backend-common/entity/Permission.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { RolePermissionRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/RolePermissionRelation.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { System } from '@probe-x/shared-utils/src/lib/backend-common/entity/System.entity'
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
  RoleType,
} from '@probe-x/shared-types/src'

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
    @InjectRepository(System)
    private systemRepo: Repository<System>,
    private dataSource: DataSource,
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
      .leftJoinAndSelect('role.system', 'system')

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
      // 判断是否为系统角色：使用 roleType 字段
      if (isSystemRole) {
        queryBuilder.andWhere('role.roleType = :roleType', { roleType: RoleType.SYSTEM })
      } else {
        queryBuilder.andWhere('role.roleType = :roleType', { roleType: RoleType.CUSTOM })
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
      const isSystemRole = role.roleType === RoleType.SYSTEM
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
        systemId: role.systemId ?? null,
        systemName: role.system?.systemName,
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
    const { roleKey, roleName, description, systemId, permissionIds = [] } = data as any

    // 验证必填字段
    if (!roleKey || !roleName) {
      return ResponseData.error('角色标识和角色名称不能为空')
    }

    // 验证角色标识格式（只能包含小写字母、数字和下划线）
    if (!/^[a-z0-9_]+$/.test(roleKey)) {
      return ResponseData.error('角色标识只能包含小写字母、数字和下划线')
    }

    // 如果指定了systemId，验证系统是否存在
    if (systemId !== undefined && systemId !== null) {
      const system = await this.systemRepo.findOne({
        where: { id: systemId },
      })
      if (!system) {
        return ResponseData.error('指定的系统不存在')
      }
    }

    // 检查角色标识是否已存在（在同一系统内）
    const existingRoleByKey = await this.roleRepo.findOne({
      where: { roleKey, systemId: systemId ?? null },
    })
    if (existingRoleByKey) {
      return ResponseData.error('该角色标识在同一系统内已存在')
    }

    // 检查角色名称是否已存在（在同一系统内）
    const existingRoleByName = await this.roleRepo.findOne({
      where: { roleName, systemId: systemId ?? null },
    })
    if (existingRoleByName) {
      return ResponseData.error('该角色名称在同一系统内已存在')
    }

    // 检查数据库中是否已存在该 roleKey 的系统角色（不允许创建与系统角色相同的 roleKey）
    const existingSystemRole = await this.roleRepo.findOne({
      where: { roleKey, roleType: RoleType.SYSTEM },
    })
    if (existingSystemRole) {
      return ResponseData.error('该角色标识已被系统角色使用，无法创建')
    }

    // 创建角色（默认为自定义角色）
    const role = this.roleRepo.create({
      roleKey,
      roleName,
      description,
      systemId: systemId ?? null,
      roleType: RoleType.CUSTOM,
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
    const { id, roleName, description, systemId, isEnable, permissionIds } = data as any

    const role = await this.roleRepo.findOne({
      where: { id },
    })

    if (!role) {
      return ResponseData.error('角色不存在')
    }

    // 检查是否为系统角色
    const isSystemRole = role.roleType === RoleType.SYSTEM
    if (isSystemRole) {
      // 系统角色中，超管（super_admin）不可编辑
      if (role.roleKey === 'super_admin') {
        return ResponseData.error('超管角色不可编辑')
      }
      // 其他系统角色只能更新描述
      if (roleName !== undefined || systemId !== undefined || isEnable !== undefined || permissionIds !== undefined) {
        return ResponseData.error('系统角色只能更新描述')
      }
    }

    // 如果指定了systemId，验证系统是否存在
    if (systemId !== undefined && systemId !== null) {
      const system = await this.systemRepo.findOne({
        where: { id: systemId },
      })
      if (!system) {
        return ResponseData.error('指定的系统不存在')
      }
    }

    // 验证角色名称是否重复（排除当前角色，在同一系统内）
    if (roleName !== undefined && roleName !== role.roleName) {
      const targetSystemId = systemId !== undefined ? systemId : role.systemId
      const existingRole = await this.roleRepo.findOne({
        where: { roleName, systemId: targetSystemId ?? null },
      })
      if (existingRole && existingRole.id !== id) {
        return ResponseData.error('该角色名称在同一系统内已存在')
      }
    }

    if (roleName !== undefined) {
      role.roleName = roleName
    }
    if (description !== undefined) {
      role.description = description
    }
    if (systemId !== undefined) {
      role.systemId = systemId ?? null
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
      // 先删后插需在同一事务中，避免中途失败导致权限关联丢失
      await this.dataSource.transaction(async (manager) => {
        // 删除旧的权限关联
        await manager.delete(RolePermissionRelation, { roleId: id })
        // 添加新的权限关联
        if (permissionIds.length > 0) {
          await this.assignPermissionsToRole(id, permissionIds, manager)
        }
      })
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
    const isSystemRole = role.roleType === RoleType.SYSTEM
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
    const isSystemRole = role.roleType === RoleType.SYSTEM
    if (isSystemRole) {
      // 超管角色（super_admin）拥有所有权限，无需分配
      if (role.roleKey === 'super_admin') {
        return ResponseData.error('超管角色拥有所有权限，无需分配')
      }
      // 其他系统角色的权限由系统配置决定，不允许手动修改
      return ResponseData.error('系统角色的权限由系统配置决定，无法手动修改')
    }

    // 验证权限是否存在（权限为全局维度，与系统无关）
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

    // 先删后插需在同一事务中，避免中途失败导致权限关联丢失
    await this.dataSource.transaction(async (manager) => {
      // 删除旧的权限关联
      await manager.delete(RolePermissionRelation, { roleId })

      // 添加新的权限关联
      if (permissionIds.length > 0) {
        // 使用去重后的权限ID
        const uniquePermissionIds = [...new Set(permissionIds)]
        await this.assignPermissionsToRole(roleId, uniquePermissionIds, manager)
      }
    })

    const result: IAssignPermissionsRes = {
      roleId,
      permissionIds: permissionIds.length > 0 ? [...new Set(permissionIds)] : [],
    }
    return ResponseData.success(result)
  }

  /**
   * 获取权限列表（树形结构）
   * 注意：页面/功能权限为全局维度，与系统无关
   */
  async getPermissionList(): Promise<IQueryPermissionListRes> {
    const permissions = await this.permissionRepo.find({
      where: { isEnable: 1 },
      order: { level: 'ASC', createdAt: 'ASC' },
    })

    // 构建树形结构
    const buildTree = (items: Permission[], parentId: number | null = null): IPermissionOption[] => {
      return items
        .filter(item => (item.parentId ?? null) === parentId)
        .map(item => ({
          id: item.id!,
          permissionKey: item.permissionKey!,
          permissionName: item.permissionName!,
          description: item.description,
          parentId: item.parentId ?? null,
          level: item.level ?? 1,
          children: buildTree(items, item.id!),
        }))
    }

    const data = buildTree(permissions)

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
      relations: ['permissionRelations', 'permissionRelations.permission', 'userRelations', 'system'],
    })

    if (!role) {
      return ResponseData.error('角色不存在')
    }

    const isSystemRole = role.roleType === RoleType.SYSTEM
    const permissionCount = role.permissionRelations?.length || 0
    const userCount = role.userRelations?.length || 0

    const result: any = {
      id: role.id!,
      roleKey: role.roleKey!,
      roleName: role.roleName!,
      description: role.description,
      isSystemRole,
      systemId: role.systemId ?? null,
      systemName: role.system?.systemName,
      isEnable: role.isEnable !== 0,
      permissionCount,
      userCount,
      createTime: role.createdAt,
      updateTime: role.updatedAt,
    }

    return ResponseData.success(result)
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
    const isSystemRole = role.roleType === RoleType.SYSTEM
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
  private async assignPermissionsToRole(roleId: number, permissionIds: number[], manager?: EntityManager): Promise<void> {
    const relations = permissionIds.map((permissionId) =>
      this.rolePermissionRepo.create({
        roleId,
        permissionId,
      }),
    )

    if (manager) {
      await manager.save(relations)
    } else {
      await this.rolePermissionRepo.save(relations)
    }
  }
}

