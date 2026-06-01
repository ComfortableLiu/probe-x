import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AlertRuleEntity, AlertHistoryEntity, NotificationEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common/entity/response.entity'
import {
  IAlertHistoryListItem,
  IAlertRuleListItem,
  ICreateAlertRuleReq,
  ICreateAlertRuleRes,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  IUpdateAlertRuleReq,
  IUpdateAlertRuleRes,
} from '@probe-x/shared-types/src'

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name)

  constructor(
    @InjectRepository(AlertRuleEntity)
    private alertRuleRepo: Repository<AlertRuleEntity>,
    @InjectRepository(AlertHistoryEntity)
    private alertHistoryRepo: Repository<AlertHistoryEntity>,
    @InjectRepository(NotificationEntity)
    private notificationRepo: Repository<NotificationEntity>,
  ) {}

  async getRuleList(params: IQueryAlertRuleListReq): Promise<IQueryAlertRuleListRes> {
    const { ruleName, ruleType, isEnable, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.alertRuleRepo.createQueryBuilder('r')

    if (ruleName) {
      qb.andWhere('r.rule_name LIKE :name', { name: `%${ruleName}%` })
    }
    if (ruleType) {
      qb.andWhere('r.rule_type = :type', { type: ruleType })
    }
    if (isEnable !== undefined) {
      qb.andWhere('r.is_enable = :enable', { enable: isEnable ? 1 : 0 })
    }

    const total = await qb.getCount()
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('r.created_at', 'DESC')
      .getMany()

    // 批量查询关联的通知配置名称（避免 N+1）
    const notificationIds = [...new Set(list.map(item => item.notificationId).filter(Boolean))]
    const notificationMap = new Map<number, string>()
    if (notificationIds.length > 0) {
      const notifications = await this.notificationRepo.findByIds(notificationIds)
      notifications.forEach(n => notificationMap.set(Number(n.id), n.notificationName!))
    }

    const data: IAlertRuleListItem[] = list.map((item) => ({
      id: Number(item.id),
      ruleName: item.ruleName!,
      ruleType: item.ruleType as any,
      condition: item.condition!,
      projectId: item.projectId ? Number(item.projectId) : undefined,
      notificationId: item.notificationId ? Number(item.notificationId) : undefined,
      notificationName: item.notificationId ? notificationMap.get(Number(item.notificationId)) : undefined,
      isEnable: item.isEnable === 1,
      description: item.description,
      lastTriggerTime: item.lastTriggerTime?.toISOString(),
      createTime: item.createdAt?.toISOString(),
      updateTime: item.updatedAt?.toISOString(),
    }))

    return { data, total, page, pageSize }
  }

  async createRule(data: ICreateAlertRuleReq): Promise<ResponseData<ICreateAlertRuleRes>> {
    const entity = this.alertRuleRepo.create({
      ruleName: data.ruleName,
      ruleType: data.ruleType,
      condition: data.condition,
      projectId: data.projectId,
      notificationId: data.notificationId,
      isEnable: data.isEnable !== false ? 1 : 0,
      description: data.description,
    })

    const saved = await this.alertRuleRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), ruleName: saved.ruleName! })
  }

  async updateRule(data: IUpdateAlertRuleReq): Promise<ResponseData<IUpdateAlertRuleRes>> {
    const entity = await this.alertRuleRepo.findOne({ where: { id: data.id } })
    if (!entity) {
      return ResponseData.error('告警规则不存在')
    }

    if (data.ruleName) entity.ruleName = data.ruleName
    if (data.ruleType) entity.ruleType = data.ruleType
    if (data.condition) entity.condition = data.condition
    if (data.projectId !== undefined) entity.projectId = data.projectId
    if (data.notificationId !== undefined) entity.notificationId = data.notificationId
    if (data.isEnable !== undefined) entity.isEnable = data.isEnable ? 1 : 0
    if (data.description !== undefined) entity.description = data.description

    const saved = await this.alertRuleRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), ruleName: saved.ruleName! })
  }

  async deleteRule(id: number): Promise<ResponseData<null>> {
    const entity = await this.alertRuleRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('告警规则不存在')
    }
    await this.alertRuleRepo.remove(entity)
    return ResponseData.success(null)
  }

  async getHistoryList(params: IQueryAlertHistoryListReq): Promise<IQueryAlertHistoryListRes> {
    const { alertLevel, alertRuleId, startTime, endTime, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.alertHistoryRepo.createQueryBuilder('h')

    if (alertLevel) {
      qb.andWhere('h.alert_level = :level', { level: alertLevel })
    }
    if (alertRuleId) {
      qb.andWhere('h.alert_rule_id = :ruleId', { ruleId: alertRuleId })
    }
    if (startTime) {
      qb.andWhere('h.created_at >= :startTime', { startTime })
    }
    if (endTime) {
      qb.andWhere('h.created_at <= :endTime', { endTime })
    }

    const total = await qb.getCount()
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('h.created_at', 'DESC')
      .getMany()

    const data: IAlertHistoryListItem[] = list.map((item) => ({
      id: Number(item.id),
      alertRuleId: Number(item.alertRuleId),
      ruleName: item.ruleName!,
      alertLevel: item.alertLevel as any,
      alertContent: item.alertContent!,
      notifyStatus: item.notifyStatus!,
      createTime: item.createdAt?.toISOString() || '',
    }))

    return { data, total, page, pageSize }
  }

  /**
   * 触发告警并发送通知
   * 由外部调用（定时任务或事件驱动）
   */
  async triggerAlert(ruleId: number, content: string, level: string = 'warning'): Promise<void> {
    const rule = await this.alertRuleRepo.findOne({ where: { id: ruleId } })
    if (!rule || rule.isEnable !== 1) {
      return
    }

    // 记录告警历史
    const history = this.alertHistoryRepo.create({
      alertRuleId: ruleId,
      ruleName: rule.ruleName,
      alertLevel: level,
      alertContent: content,
      notifyStatus: 'pending',
    })
    const savedHistory = await this.alertHistoryRepo.save(history)

    // 更新规则最后触发时间
    rule.lastTriggerTime = new Date()
    await this.alertRuleRepo.save(rule)

    // 通过通知配置发送告警
    if (rule.notificationId) {
      try {
        const notification = await this.notificationRepo.findOne({ where: { id: rule.notificationId } })
        if (notification && notification.isEnable === 1) {
          // TODO: 实际调用 NotificationService 发送通知
          // 当前标记为已发送
          savedHistory.notifyStatus = 'sent'
          await this.alertHistoryRepo.save(savedHistory)
          this.logger.log(`Alert notification sent for rule ${ruleId}: ${content}`)
        }
      } catch (err) {
        savedHistory.notifyStatus = 'failed'
        await this.alertHistoryRepo.save(savedHistory)
        this.logger.error(`Failed to send alert notification for rule ${ruleId}`, err)
      }
    }
  }
}
