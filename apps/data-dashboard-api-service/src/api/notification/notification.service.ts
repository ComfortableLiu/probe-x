import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { NotificationEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/Notification.entity'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common/entity/response.entity'
import {
  ICreateNotificationReq,
  ICreateNotificationRes,
  INotificationListItem,
  IQueryNotificationListReq,
  IQueryNotificationListRes,
  ITestSendNotificationRes,
  IUpdateNotificationReq,
  IUpdateNotificationRes,
} from '@probe-x/shared-types/src'

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private notificationRepo: Repository<NotificationEntity>,
  ) {}

  async getList(params: IQueryNotificationListReq): Promise<IQueryNotificationListRes> {
    const { notificationName, notificationType, isEnable, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.notificationRepo.createQueryBuilder('n')

    if (notificationName) {
      qb.andWhere('n.notification_name LIKE :name', { name: `%${notificationName}%` })
    }
    if (notificationType) {
      qb.andWhere('n.notification_type = :type', { type: notificationType })
    }
    if (isEnable !== undefined) {
      qb.andWhere('n.is_enable = :enable', { enable: isEnable ? 1 : 0 })
    }

    const total = await qb.getCount()
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('n.created_at', 'DESC')
      .getMany()

    const data: INotificationListItem[] = list.map(item => ({
      id: Number(item.id),
      notificationName: item.notificationName!,
      notificationType: item.notificationType as any,
      recipients: item.recipients!,
      triggerCondition: item.triggerCondition,
      config: item.config || '{}',
      isEnable: item.isEnable === 1,
      lastSendTime: item.lastSendTime?.toISOString(),
      description: item.description,
      createTime: item.createdAt?.toISOString(),
      updateTime: item.updatedAt?.toISOString(),
    }))

    return { data, total, page, pageSize }
  }

  async create(data: ICreateNotificationReq): Promise<ResponseData<ICreateNotificationRes>> {
    const entity = this.notificationRepo.create({
      notificationName: data.notificationName,
      notificationType: data.notificationType,
      recipients: data.recipients,
      triggerCondition: data.triggerCondition,
      config: data.config,
      isEnable: data.isEnable !== false ? 1 : 0,
      description: data.description,
    })

    const saved = await this.notificationRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), notificationName: saved.notificationName! })
  }

  async update(data: IUpdateNotificationReq): Promise<ResponseData<IUpdateNotificationRes>> {
    const entity = await this.notificationRepo.findOne({ where: { id: data.id } })
    if (!entity) {
      return ResponseData.error('通知配置不存在')
    }

    if (data.notificationName) entity.notificationName = data.notificationName
    if (data.notificationType) entity.notificationType = data.notificationType
    if (data.recipients) entity.recipients = data.recipients
    if (data.triggerCondition !== undefined) entity.triggerCondition = data.triggerCondition
    if (data.config) entity.config = data.config
    if (data.isEnable !== undefined) entity.isEnable = data.isEnable ? 1 : 0
    if (data.description !== undefined) entity.description = data.description

    const saved = await this.notificationRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), notificationName: saved.notificationName! })
  }

  async delete(id: number): Promise<ResponseData<null>> {
    const entity = await this.notificationRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('通知配置不存在')
    }
    await this.notificationRepo.remove(entity)
    return ResponseData.success(null)
  }

  async testSend(id: number): Promise<ResponseData<ITestSendNotificationRes>> {
    const entity = await this.notificationRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('通知配置不存在')
    }

    // TODO: 实际发送测试通知逻辑，当前返回模拟结果
    entity.lastSendTime = new Date()
    await this.notificationRepo.save(entity)

    return ResponseData.success({
      success: true,
      message: '测试通知发送成功',
    })
  }
}
