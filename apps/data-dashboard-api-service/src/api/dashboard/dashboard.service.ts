import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, SelectQueryBuilder } from 'typeorm'
import {
  DashboardEntity,
  RedisService,
  BusinessException,
  UserRoleRelation,
  Role,
} from '@probe-x/shared-utils/src/lib/backend-common'
import {
  IUser,
  ICreateDashboardReq,
  IUpdateDashboardReq,
  IQueryDashboardListReq,
  IDashboard,
  IDashboardListRes,
  IQueryDashboardDataReq,
  IDashboardDataRes,
  IConvertToPublicDashboardReq,
  DashboardType,
  AnalysisType,
} from '@probe-x/shared-types/src'
import { EventAnalysisService } from '../data-analysis/event-analysis.service'
import { FunnelAnalysisService } from '../data-analysis/funnel-analysis.service'
import { UserPathAnalysisService } from '../data-analysis/user-path-analysis.service'
import { AttributionAnalysisService } from '../data-analysis/attribution-analysis.service'

/**
 * 看板缓存Key前缀
 */
const DASHBOARD_CACHE_KEY_PREFIX = 'dashboard:'
const DASHBOARD_LIST_CACHE_KEY_PREFIX = 'dashboard:list:'
const DASHBOARD_DATA_CACHE_KEY_PREFIX = 'dashboard:data:'
const CACHE_EXPIRE_SECONDS = 300 // 缓存5分钟

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name)

  constructor(
    @InjectRepository(DashboardEntity)
    private dashboardRepository: Repository<DashboardEntity>,
    @InjectRepository(UserRoleRelation)
    private userRoleRepository: Repository<UserRoleRelation>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private readonly redisService: RedisService,
    private readonly eventAnalysisService: EventAnalysisService,
    private readonly funnelAnalysisService: FunnelAnalysisService,
    private readonly userPathAnalysisService: UserPathAnalysisService,
    private readonly attributionAnalysisService: AttributionAnalysisService,
  ) {}

  /**
   * 创建看板
   */
  async createDashboard(data: ICreateDashboardReq, user: IUser): Promise<IDashboard> {
    // 验证权限：公共看板只有管理员可以创建
    if (data.type === DashboardType.PUBLIC && !(await this.isAdmin(user))) {
      throw new BusinessException('只有管理员可以创建公共看板')
    }

    const dashboard = this.dashboardRepository.create({
      name: data.name,
      type: data.type,
      creatorId: user.userId,
      creatorName: user.username || user.nickname || '',
      analysisType: data.analysisType,
      config: data.config,
      displayChart: data.displayChart ?? true,
      displayTable: data.displayTable ?? true,
      permissions: data.permissions || [],
      isDeleted: false,
    })

    const saved = await this.dashboardRepository.save(dashboard)

    // 清除相关缓存
    await this.clearCache(user.userId)

    return this.entityToDto(saved)
  }

  /**
   * 获取单个看板信息
   */
  async getDashboard(id: number, user: IUser): Promise<IDashboard> {
    const dashboard = await this.dashboardRepository.findOne({
      where: { id, isDeleted: false },
    })

    if (!dashboard) {
      throw new BusinessException('看板不存在')
    }

    // 验证权限：个人看板只能创建者查看，公共看板需要检查权限
    if (dashboard.type === DashboardType.PERSONAL && dashboard.creatorId !== user.userId) {
      throw new BusinessException('无权限查看此看板')
    }
    if (dashboard.type === DashboardType.PUBLIC && !(await this.canViewPublicDashboard(dashboard, user))) {
      throw new BusinessException('无权限查看此看板')
    }

    return this.entityToDto(dashboard)
  }

  /**
   * 更新看板
   */
  async updateDashboard(data: IUpdateDashboardReq, user: IUser): Promise<IDashboard> {
    const dashboard = await this.dashboardRepository.findOne({
      where: { id: data.id, isDeleted: false },
    })

    if (!dashboard) {
      throw new BusinessException('看板不存在')
    }

    // 验证权限：个人看板只能创建者修改，公共看板只有管理员可以修改
    if (dashboard.type === DashboardType.PERSONAL && dashboard.creatorId !== user.userId) {
      throw new BusinessException('无权限修改此看板')
    }
    if (dashboard.type === DashboardType.PUBLIC && !(await this.isAdmin(user))) {
      throw new BusinessException('只有管理员可以修改公共看板')
    }

    // 更新字段
    if (data.name !== undefined) dashboard.name = data.name
    if (data.config !== undefined) dashboard.config = data.config
    if (data.displayChart !== undefined) dashboard.displayChart = data.displayChart
    if (data.displayTable !== undefined) dashboard.displayTable = data.displayTable
    if (data.permissions !== undefined && dashboard.type === DashboardType.PUBLIC) {
      dashboard.permissions = data.permissions
    }

    const updated = await this.dashboardRepository.save(dashboard)

    // 清除相关缓存
    await this.clearCache(dashboard.creatorId, dashboard.id)

    return this.entityToDto(updated)
  }

  /**
   * 删除看板（软删除）
   */
  async deleteDashboard(id: number, user: IUser): Promise<void> {
    const dashboard = await this.dashboardRepository.findOne({
      where: { id, isDeleted: false },
    })

    if (!dashboard) {
      throw new BusinessException('看板不存在')
    }

    // 验证权限：个人看板只能创建者删除，公共看板只有管理员可以删除
    if (dashboard.type === DashboardType.PERSONAL && dashboard.creatorId !== user.userId) {
      throw new BusinessException('无权限删除此看板')
    }
    if (dashboard.type === DashboardType.PUBLIC && !(await this.isAdmin(user))) {
      throw new BusinessException('只有管理员可以删除公共看板')
    }

    dashboard.isDeleted = true
    await this.dashboardRepository.save(dashboard)

    // 清除相关缓存
    await this.clearCache(dashboard.creatorId, id)
  }

  /**
   * 查询看板列表（带缓存）
   */
  async queryDashboardList(
    data: IQueryDashboardListReq,
    user: IUser,
  ): Promise<IDashboardListRes> {
    const cacheKey = this.getListCacheKey(user.userId, data)

    // 尝试从缓存获取
    const cached = await this.redisService.get<IDashboardListRes>(cacheKey)
    if (cached) {
      // 过滤用户有权限查看的看板
      return await this.filterAccessibleDashboards(cached, user)
    }

    const page = data.page || 1
    const pageSize = data.pageSize || 10
    const skip = (page - 1) * pageSize

    const queryBuilder = this.dashboardRepository
      .createQueryBuilder('dashboard')
      .where('dashboard.isDeleted = :isDeleted', { isDeleted: false })

    // 如果是查询个人看板，只返回当前用户的看板
    if (data.type === DashboardType.PERSONAL) {
      queryBuilder.andWhere('dashboard.type = :type', { type: DashboardType.PERSONAL })
      queryBuilder.andWhere('dashboard.creatorId = :creatorId', { creatorId: user.userId })
    }
    // 如果是查询公共看板，需要检查权限
    else if (data.type === DashboardType.PUBLIC) {
      queryBuilder.andWhere('dashboard.type = :type', { type: DashboardType.PUBLIC })
      const isUserAdmin = await this.isAdmin(user)
      // 如果是管理员，可以看到所有公共看板
      if (!isUserAdmin) {
        // 非管理员只能看到有权限的公共看板
        const { roleKey: userRole } = await this.getUserRoleInfo(user)
        queryBuilder.andWhere(
          '(dashboard.permissions IS NULL OR JSON_LENGTH(dashboard.permissions) = 0 OR JSON_CONTAINS(dashboard.permissions, :userRole))',
          { userRole: JSON.stringify(userRole) },
        )
      }
    }
    // 如果没有指定类型，返回用户有权限查看的所有看板
    else {
      const isUserAdmin = await this.isAdmin(user)
      const { roleKey: userRole } = await this.getUserRoleInfo(user)
      // 对于公共看板，如果没有设置权限（NULL 或空数组），所有用户都可以查看
      // 这与 canViewPublicDashboard 方法的逻辑一致
      queryBuilder.andWhere(
        '(dashboard.type = :personal AND dashboard.creatorId = :creatorId) OR (dashboard.type = :public AND (:isAdmin = 1 OR dashboard.permissions IS NULL OR JSON_LENGTH(dashboard.permissions) = 0 OR JSON_CONTAINS(dashboard.permissions, :userRole)))',
        {
          personal: DashboardType.PERSONAL,
          public: DashboardType.PUBLIC,
          creatorId: user.userId,
          isAdmin: isUserAdmin ? 1 : 0,
          userRole: JSON.stringify(userRole),
        },
      )
    }

    if (data.analysisType) {
      queryBuilder.andWhere('dashboard.analysisType = :analysisType', {
        analysisType: data.analysisType,
      })
    }

    queryBuilder.orderBy('dashboard.createTime', 'DESC').skip(skip).take(pageSize)

    const [list, total] = await queryBuilder.getManyAndCount()

    const result: IDashboardListRes = {
      list: list.map((item) => this.entityToDto(item)),
      total,
      page,
      pageSize,
    }

    // 缓存结果
    await this.redisService.set(cacheKey, result, CACHE_EXPIRE_SECONDS)

    return result
  }

  /**
   * 查询看板数据（带缓存）
   */
  async queryDashboardData(
    data: IQueryDashboardDataReq,
    user: IUser,
  ): Promise<IDashboardDataRes> {
    const dashboard = await this.dashboardRepository.findOne({
      where: { id: data.dashboardId, isDeleted: false },
    })

    if (!dashboard) {
      throw new BusinessException('看板不存在')
    }

    // 验证权限：个人看板只能创建者查看，公共看板需要检查权限
    if (dashboard.type === DashboardType.PERSONAL && dashboard.creatorId !== user.userId) {
      throw new BusinessException('无权限查看此看板')
    }
    if (dashboard.type === DashboardType.PUBLIC && !(await this.canViewPublicDashboard(dashboard, user))) {
      throw new BusinessException('无权限查看此看板')
    }

    // 构建缓存Key（包含时间范围）
    const timeRangeKey = data.timeRange ? data.timeRange.join('_') : 'default'
    const cacheKey = `${DASHBOARD_DATA_CACHE_KEY_PREFIX}${data.dashboardId}:${timeRangeKey}`

    // 尝试从缓存获取
    const cached = await this.redisService.get<IDashboardDataRes>(cacheKey)
    if (cached) {
      return cached
    }

    // 获取看板配置，检查是否为 null 或 undefined
    const config = dashboard.config
    if (!config) {
      throw new BusinessException('看板配置为空，无法查询数据')
    }

    let analysisData: any

    // 根据分析类型查询数据
    if (dashboard.analysisType === AnalysisType.EVENT && config.eventAnalysis) {
      const queryParams = { ...config.eventAnalysis }
      if (data.timeRange) {
        queryParams.timeRange = data.timeRange
      }
      analysisData = await this.eventAnalysisService.queryEvent(queryParams, user)
    } else if (dashboard.analysisType === AnalysisType.FUNNEL && config.funnelAnalysis) {
      const queryParams = { ...config.funnelAnalysis }
      if (data.timeRange) {
        queryParams.timeRange = data.timeRange
      }
      analysisData = await this.funnelAnalysisService.queryEvent(queryParams, user)
    } else if (
      dashboard.analysisType === AnalysisType.USER_PATH &&
      config.userPathAnalysis
    ) {
      const queryParams = { ...config.userPathAnalysis }
      if (data.timeRange) {
        queryParams.timeRange = data.timeRange
      }
      analysisData = await this.userPathAnalysisService.queryEvent(queryParams, user)
    } else if (
      dashboard.analysisType === AnalysisType.ATTRIBUTION &&
      config.attributionAnalysis
    ) {
      const queryParams = { ...config.attributionAnalysis }
      if (data.timeRange) {
        queryParams.timeRange = data.timeRange
      }
      analysisData = await this.attributionAnalysisService.queryEvent(queryParams, user)
    }

    // 检查配置是否匹配分析类型
    if (analysisData === undefined) {
      const analysisTypeName = {
        [AnalysisType.EVENT]: '事件分析',
        [AnalysisType.FUNNEL]: '漏斗分析',
        [AnalysisType.USER_PATH]: '用户路径分析',
        [AnalysisType.ATTRIBUTION]: '归因分析',
      }[dashboard.analysisType] || dashboard.analysisType
      
      throw new BusinessException(
        `看板配置错误：看板类型为 ${analysisTypeName}，但缺少对应的配置信息`
      )
    }

    const result: IDashboardDataRes = {
      dashboardId: dashboard.id,
      analysisType: dashboard.analysisType,
      data: analysisData,
      chartData: dashboard.displayChart ? analysisData : undefined,
      tableData: dashboard.displayTable ? analysisData : undefined,
    }

    // 缓存结果
    await this.redisService.set(cacheKey, result, CACHE_EXPIRE_SECONDS)

    return result
  }

  /**
   * 将个人看板转为公共看板
   */
  async convertToPublicDashboard(data: IConvertToPublicDashboardReq, user: IUser): Promise<IDashboard> {
    const dashboard = await this.dashboardRepository.findOne({
      where: { id: data.id, isDeleted: false },
    })

    if (!dashboard) {
      throw new BusinessException('看板不存在')
    }

    // 验证权限：只有创建者可以转换
    if (dashboard.creatorId !== user.userId) {
      throw new BusinessException('无权限转换此看板')
    }

    if (dashboard.type === DashboardType.PUBLIC) {
      throw new BusinessException('该看板已经是公共看板')
    }

    // 转换为公共看板
    dashboard.type = DashboardType.PUBLIC
    if (data.permissions) {
      dashboard.permissions = data.permissions
    }

    const updated = await this.dashboardRepository.save(dashboard)

    // 清除相关缓存
    await this.clearCache(user.userId, dashboard.id)

    return this.entityToDto(updated)
  }

  /**
   * 获取用户角色信息（一次查询，包含管理员判断和角色key）
   * 返回 { isAdmin, roleKey }
   */
  private async getUserRoleInfo(user: IUser): Promise<{ isAdmin: boolean; roleKey: string }> {
    if (!user.userId) {
      return { isAdmin: false, roleKey: 'user' }
    }
    const userRoles = await this.userRoleRepository
      .createQueryBuilder('user_role')
      .leftJoinAndSelect('user_role.role', 'role')
      .where('user_role.user_id = :userId', { userId: user.userId })
      .getMany()

    const roleKeys = userRoles.map((ur) => ur.role?.roleKey).filter(Boolean)
    const isAdmin = roleKeys.some((roleKey) => roleKey === 'admin' || roleKey === 'super_admin')
    const roleKey = roleKeys[0] || 'user'
    return { isAdmin, roleKey }
  }

  /**
   * 检查用户是否为管理员
   */
  private async isAdmin(user: IUser): Promise<boolean> {
    const { isAdmin } = await this.getUserRoleInfo(user)
    return isAdmin
  }

  /**
   * 检查用户是否可以查看公共看板（使用预取的角色信息，避免重复查询）
   */
  private canViewPublicDashboardWithRole(
    dashboard: DashboardEntity,
    userRoleInfo: { isAdmin: boolean; roleKey: string },
  ): boolean {
    // 管理员可以查看所有公共看板
    if (userRoleInfo.isAdmin) {
      return true
    }

    // 如果没有设置权限，所有人都可以查看
    if (!dashboard.permissions || dashboard.permissions.length === 0) {
      return true
    }

    // 检查用户角色是否在权限列表中
    return dashboard.permissions.includes(userRoleInfo.roleKey)
  }

  /**
   * 过滤有权限查看的看板（批量处理，只查询一次用户角色）
   * 同时修正 total 为过滤后的可访问总数
   */
  private async filterAccessibleDashboards(
    result: IDashboardListRes,
    user: IUser,
  ): Promise<IDashboardListRes> {
    // 只查询一次用户角色信息
    const userRoleInfo = await this.getUserRoleInfo(user)

    const filteredList = result.list.filter((dashboard) => {
      if (dashboard.type === DashboardType.PERSONAL) {
        return dashboard.creatorId === user.userId
      }
      return this.canViewPublicDashboardWithRole(
        {
          ...dashboard,
          permissions: dashboard.permissions || [],
        } as DashboardEntity,
        userRoleInfo,
      )
    })

    // 修正 total：缓存的 total 是数据库原始值，过滤后应反映可访问数量
    // 使用差值估算：total 减去本页被过滤掉的数量
    const removedCount = result.list.length - filteredList.length
    const adjustedTotal = Math.max(0, result.total - removedCount)

    return {
      ...result,
      list: filteredList,
      total: adjustedTotal,
    }
  }

  /**
   * 实体转DTO
   */
  private entityToDto(entity: DashboardEntity): IDashboard {
    return {
      id: entity.id!,
      name: entity.name!,
      type: entity.type!,
      creatorId: entity.creatorId!,
      creatorName: entity.creatorName!,
      analysisType: entity.analysisType!,
      config: entity.config || {},
      displayChart: entity.displayChart ?? true,
      displayTable: entity.displayTable ?? true,
      permissions: entity.permissions || [],
      createTime: entity.createTime?.toISOString() || '',
      updateTime: entity.updateTime?.toISOString() || '',
    }
  }

  /**
   * 获取列表缓存Key
   */
  private getListCacheKey(userId: number, data: IQueryDashboardListReq): string {
    const type = data.type || 'all'
    const analysisType = data.analysisType || 'all'
    const page = data.page || 1
    const pageSize = data.pageSize || 10
    return `${DASHBOARD_LIST_CACHE_KEY_PREFIX}${userId}:${type}:${analysisType}:${page}:${pageSize}`
  }

  /**
   * 清除缓存
   */
  private async clearCache(userId: number, dashboardId?: number): Promise<void> {
    try {
      // 清除列表缓存（模糊匹配）
      const listPattern = `${DASHBOARD_LIST_CACHE_KEY_PREFIX}${userId}:*`
      await this.redisService.delByPattern(listPattern)

      // 如果指定了看板ID，清除该看板的数据缓存
      if (dashboardId) {
        const dataPattern = `${DASHBOARD_DATA_CACHE_KEY_PREFIX}${dashboardId}:*`
        await this.redisService.delByPattern(dataPattern)
      }
    } catch (error) {
      // 缓存清除失败不应该影响主流程，只记录错误
      this.logger.error('清除看板缓存失败:', error)
    }
  }
}
