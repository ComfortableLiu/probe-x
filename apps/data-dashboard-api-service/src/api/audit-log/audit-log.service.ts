import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { IAuditLogListItem, IQueryAuditLogListReq, IQueryAuditLogListRes } from '@probe-x/shared-types/src'

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  async getList(params: IQueryAuditLogListReq): Promise<IQueryAuditLogListRes> {
    const { username, action, method, startTime, endTime, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.auditLogRepo.createQueryBuilder('a')

    if (username) {
      qb.andWhere('a.username LIKE :username', { username: `%${username}%` })
    }
    if (action) {
      qb.andWhere('a.action = :action', { action })
    }
    if (method) {
      qb.andWhere('a.method = :method', { method })
    }
    if (startTime) {
      qb.andWhere('a.created_at >= :startTime', { startTime })
    }
    if (endTime) {
      qb.andWhere('a.created_at <= :endTime', { endTime })
    }

    const total = await qb.getCount()
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('a.created_at', 'DESC')
      .getMany()

    const data: IAuditLogListItem[] = list.map((item) => ({
      id: Number(item.id),
      userId: item.userId ? Number(item.userId) : undefined,
      username: item.username!,
      action: item.action!,
      method: item.method!,
      path: item.path!,
      requestBody: item.requestBody,
      responseStatus: item.responseStatus,
      ip: item.ip,
      userAgent: item.userAgent,
      createTime: item.createdAt?.toISOString() || '',
    }))

    return { data, total, page, pageSize }
  }

  async createLog(data: {
    userId?: number
    username?: string
    action: string
    method: string
    path: string
    requestBody?: string
    responseStatus?: number
    ip?: string
    userAgent?: string
  }): Promise<void> {
    const entity = this.auditLogRepo.create({
      userId: data.userId,
      username: data.username || 'unknown',
      action: data.action,
      method: data.method,
      path: data.path,
      requestBody: data.requestBody,
      responseStatus: data.responseStatus,
      ip: data.ip,
      userAgent: data.userAgent,
    })
    await this.auditLogRepo.save(entity)
  }
}
