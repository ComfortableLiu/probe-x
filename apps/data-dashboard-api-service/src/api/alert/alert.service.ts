import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { AlertRuleEntity, AlertHistoryEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common/entity/response.entity'
import {
  AlertLevel,
  AlertOperator,
  IAlertHistory,
  IAlertRule,
  ICreateAlertRuleReq,
  ICreateAlertRuleRes,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  IUpdateAlertRuleReq,
  IUpdateAlertRuleRes,
} from '@probe-x/shared-types/src'
import { ALERT_SCAN_INTERVAL, ALERT_SCAN_SCHEDULER_ID, QUEUE_NAME, QUEUE_TASK_NAME } from './type'

@Injectable()
export class AlertService implements OnModuleInit {
  private readonly logger = new Logger(AlertService.name)

  constructor(
    @InjectRepository(AlertRuleEntity)
    private alertRuleRepo: Repository<AlertRuleEntity>,
    @InjectRepository(AlertHistoryEntity)
    private alertHistoryRepo: Repository<AlertHistoryEntity>,
    @InjectQueue(QUEUE_NAME)
    private readonly alertQueue: Queue,
  ) {}

  /**
   * 注册单例 repeatable 扫描任务（固定调度器 ID，重启不会重复注册）
   * 每 60s 扫描一次全部启用且到期的规则，而非每规则一个 job
   */
  async onModuleInit() {
    await this.alertQueue.upsertJobScheduler(
      ALERT_SCAN_SCHEDULER_ID,
      { every: ALERT_SCAN_INTERVAL },
      {
        name: QUEUE_TASK_NAME,
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: { count: 100 },
        },
      },
    )
    this.logger.log(`告警扫描任务已注册，周期 ${ALERT_SCAN_INTERVAL / 1000}s`)
  }

  async getRuleList(params: IQueryAlertRuleListReq): Promise<IQueryAlertRuleListRes> {
    const { name, level, enabled, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.alertRuleRepo.createQueryBuilder('r')

    if (name) {
      qb.andWhere('r.name LIKE :name', { name: `%${name}%` })
    }
    if (level) {
      qb.andWhere('r.level = :level', { level })
    }
    if (enabled !== undefined) {
      qb.andWhere('r.enabled = :enabled', { enabled: enabled ? 1 : 0 })
    }

    const total = await qb.getCount()
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('r.created_at', 'DESC')
      .getMany()

    const data: IAlertRule[] = list.map((item) => this.toRule(item))

    return { data, total, page, pageSize }
  }

  async createRule(data: ICreateAlertRuleReq, userId?: number): Promise<ResponseData<ICreateAlertRuleRes>> {
    const entity = this.alertRuleRepo.create({
      name: data.name,
      eventName: data.eventName,
      windowMinutes: data.windowMinutes,
      checkIntervalMinutes: data.checkIntervalMinutes,
      operator: data.operator,
      threshold: data.threshold,
      level: data.level || 'warning',
      webhookUrl: data.webhookUrl,
      enabled: data.enabled !== false ? 1 : 0,
      createUserId: userId ? Number(userId) : undefined,
    })

    const saved = await this.alertRuleRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), name: saved.name! })
  }

  async updateRule(data: IUpdateAlertRuleReq): Promise<ResponseData<IUpdateAlertRuleRes>> {
    const entity = await this.alertRuleRepo.findOne({ where: { id: data.id } })
    if (!entity) {
      return ResponseData.error('告警规则不存在')
    }

    if (data.name !== undefined) entity.name = data.name
    if (data.eventName !== undefined) entity.eventName = data.eventName
    if (data.windowMinutes !== undefined) entity.windowMinutes = data.windowMinutes
    if (data.checkIntervalMinutes !== undefined) entity.checkIntervalMinutes = data.checkIntervalMinutes
    if (data.operator !== undefined) entity.operator = data.operator
    if (data.threshold !== undefined) entity.threshold = data.threshold
    if (data.level !== undefined) entity.level = data.level
    if (data.webhookUrl !== undefined) entity.webhookUrl = data.webhookUrl
    if (data.enabled !== undefined) entity.enabled = data.enabled ? 1 : 0

    const saved = await this.alertRuleRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), name: saved.name! })
  }

  async deleteRule(id: number): Promise<ResponseData<null>> {
    const entity = await this.alertRuleRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('告警规则不存在')
    }
    await this.alertRuleRepo.remove(entity)
    return ResponseData.success(null)
  }

  async toggleRule(id: number, enabled: boolean): Promise<ResponseData<null>> {
    const entity = await this.alertRuleRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('告警规则不存在')
    }
    entity.enabled = enabled ? 1 : 0
    await this.alertRuleRepo.save(entity)
    return ResponseData.success(null)
  }

  async getHistoryList(params: IQueryAlertHistoryListReq): Promise<IQueryAlertHistoryListRes> {
    const { ruleId, level, startTime, endTime, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.alertHistoryRepo.createQueryBuilder('h')

    if (ruleId) {
      qb.andWhere('h.rule_id = :ruleId', { ruleId })
    }
    if (level) {
      qb.andWhere('h.level = :level', { level })
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

    // 批量查询关联的规则名称（避免 N+1）
    const ruleIds = [...new Set(list.map(item => Number(item.ruleId)).filter(Boolean))]
    const ruleNameMap = new Map<number, string>()
    if (ruleIds.length > 0) {
      const rules = await this.alertRuleRepo.findByIds(ruleIds)
      rules.forEach(r => ruleNameMap.set(Number(r.id), r.name!))
    }

    const data: IAlertHistory[] = list.map((item) => ({
      id: Number(item.id),
      ruleId: Number(item.ruleId),
      ruleName: ruleNameMap.get(Number(item.ruleId)),
      metricValue: Number(item.metricValue),
      threshold: Number(item.threshold),
      level: item.level as AlertLevel,
      webhookStatus: item.webhookStatus as IAlertHistory['webhookStatus'],
      error: item.error || undefined,
      createTime: item.createdAt?.toISOString() || '',
    }))

    return { data, total, page, pageSize }
  }

  private toRule(item: AlertRuleEntity): IAlertRule {
    return {
      id: Number(item.id),
      name: item.name!,
      eventName: item.eventName!,
      windowMinutes: item.windowMinutes!,
      checkIntervalMinutes: item.checkIntervalMinutes!,
      operator: item.operator as AlertOperator,
      threshold: Number(item.threshold),
      level: item.level as AlertLevel,
      webhookUrl: item.webhookUrl!,
      enabled: item.enabled === 1,
      lastCheckedAt: item.lastCheckedAt?.toISOString(),
      lastTriggeredAt: item.lastTriggeredAt?.toISOString(),
      createUserId: item.createUserId ? Number(item.createUserId) : undefined,
      createTime: item.createdAt?.toISOString(),
      updateTime: item.updatedAt?.toISOString(),
    }
  }
}
