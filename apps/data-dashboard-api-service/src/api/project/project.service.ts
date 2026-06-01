import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProjectEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/Project.entity'
import { UserProjectRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserProjectRelation.entity'
import { UserEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/User.entity'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common/entity/response.entity'
import {
  ICreateProjectReq,
  ICreateProjectRes,
  IProjectListItem,
  IProjectMemberItem,
  IQueryProjectListReq,
  IQueryProjectListRes,
  IUpdateProjectReq,
  IUpdateProjectRes,
  IAddProjectMemberReq,
  IRemoveProjectMemberReq,
} from '@probe-x/shared-types/src'

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(ProjectEntity)
    private projectRepo: Repository<ProjectEntity>,
    @InjectRepository(UserProjectRelation)
    private userProjectRepo: Repository<UserProjectRelation>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {}

  async getList(params: IQueryProjectListReq): Promise<IQueryProjectListRes> {
    const { projectName, projectKey, isEnable, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.projectRepo.createQueryBuilder('p')

    if (projectName) {
      qb.andWhere('p.project_name LIKE :name', { name: `%${projectName}%` })
    }
    if (projectKey) {
      qb.andWhere('p.project_key LIKE :key', { key: `%${projectKey}%` })
    }
    if (isEnable !== undefined) {
      qb.andWhere('p.is_enable = :enable', { enable: isEnable ? 1 : 0 })
    }

    const total = await qb.getCount()
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('p.created_at', 'DESC')
      .getMany()

    // 批量查询每个项目的成员数量（避免 N+1）
    const projectIds = list.map(item => Number(item.id))
    const memberCounts = new Map<number, number>()
    if (projectIds.length > 0) {
      const counts = await this.userProjectRepo
        .createQueryBuilder('up')
        .select('up.project_id', 'projectId')
        .addSelect('COUNT(*)', 'count')
        .where('up.project_id IN (:...projectIds)', { projectIds })
        .groupBy('up.project_id')
        .getRawMany()
      counts.forEach((r: any) => memberCounts.set(Number(r.projectId), Number(r.count)))
    }

    const data: IProjectListItem[] = list.map((item) => ({
      id: Number(item.id),
      projectName: item.projectName!,
      projectKey: item.projectKey!,
      description: item.description,
      isEnable: item.isEnable === 1,
      memberCount: memberCounts.get(Number(item.id)) || 0,
      createTime: item.createdAt?.toISOString(),
      updateTime: item.updatedAt?.toISOString(),
    }))

    return { data, total, page, pageSize }
  }

  async create(data: ICreateProjectReq): Promise<ResponseData<ICreateProjectRes>> {
    // 检查 projectKey 唯一性
    const existing = await this.projectRepo.findOne({ where: { projectKey: data.projectKey } })
    if (existing) {
      return ResponseData.error('项目标识已存在')
    }

    const entity = this.projectRepo.create({
      projectName: data.projectName,
      projectKey: data.projectKey,
      description: data.description,
      isEnable: data.isEnable !== false ? 1 : 0,
    })

    const saved = await this.projectRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), projectName: saved.projectName!, projectKey: saved.projectKey! })
  }

  async update(data: IUpdateProjectReq): Promise<ResponseData<IUpdateProjectRes>> {
    const entity = await this.projectRepo.findOne({ where: { id: data.id } })
    if (!entity) {
      return ResponseData.error('项目不存在')
    }

    if (data.projectName) entity.projectName = data.projectName
    if (data.description !== undefined) entity.description = data.description
    if (data.isEnable !== undefined) entity.isEnable = data.isEnable ? 1 : 0

    const saved = await this.projectRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), projectName: saved.projectName! })
  }

  async delete(id: number): Promise<ResponseData<null>> {
    const entity = await this.projectRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('项目不存在')
    }
    await this.projectRepo.remove(entity)
    return ResponseData.success(null)
  }

  async getMembers(projectId: number): Promise<ResponseData<IProjectMemberItem[]>> {
    const relations = await this.userProjectRepo.find({
      where: { project: { id: projectId } },
      relations: ['user'],
    })

    const members: IProjectMemberItem[] = relations.map((r) => ({
      userId: r.user?.userId!,
      username: r.user?.username!,
      nickname: r.user?.nickname,
      joinTime: r.createdAt?.toISOString(),
    }))

    return ResponseData.success(members)
  }

  async addMembers(data: IAddProjectMemberReq): Promise<ResponseData<null>> {
    for (const userId of data.userIds) {
      const existing = await this.userProjectRepo.findOne({
        where: { user: { userId }, project: { id: data.projectId } },
      })
      if (!existing) {
        const relation = this.userProjectRepo.create({
          user: { userId } as any,
          project: { id: data.projectId } as any,
        })
        await this.userProjectRepo.save(relation)
      }
    }
    return ResponseData.success(null)
  }

  async removeMember(data: IRemoveProjectMemberReq): Promise<ResponseData<null>> {
    const relation = await this.userProjectRepo.findOne({
      where: { user: { userId: data.userId }, project: { id: data.projectId } },
    })
    if (relation) {
      await this.userProjectRepo.remove(relation)
    }
    return ResponseData.success(null)
  }
}
