import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Job } from 'bullmq'
import axios from 'axios'
import { AlertRuleEntity, AlertHistoryEntity, ClickHouseService } from '@probe-x/shared-utils/src/lib/backend-common'
import { AlertWebhookStatus } from '@probe-x/shared-types/src'
import { IAlertWebhookPayload, QUEUE_NAME, QUEUE_TASK_NAME } from './type'

@Processor(QUEUE_NAME)
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name)

  constructor(
    @InjectRepository(AlertRuleEntity)
    private alertRuleRepo: Repository<AlertRuleEntity>,
    @InjectRepository(AlertHistoryEntity)
    private alertHistoryRepo: Repository<AlertHistoryEntity>,
    private clickHouseService: ClickHouseService,
  ) {
    super()
  }

  /**
   * 扫描全部启用且到期的规则（last_checked_at + check_interval < now）
   * 由单例 repeatable job 周期性触发
   */
  async process(job: Job) {
    if (job.name !== QUEUE_TASK_NAME) return

    const now = new Date()
    const rules = await this.alertRuleRepo.createQueryBuilder('r')
      .where('r.enabled = 1')
      .andWhere('(r.last_checked_at IS NULL OR DATE_ADD(r.last_checked_at, INTERVAL r.check_interval_minutes MINUTE) <= :now)', { now })
      .getMany()

    for (const rule of rules) {
      await this.checkRule(rule, now)
    }
  }

  /**
   * 检查单条规则：统计时间窗内事件次数，满足条件则触发告警
   */
  private async checkRule(rule: AlertRuleEntity, now: Date) {
    try {
      const rows = await this.clickHouseService.query<{ cnt: string }>(`
        SELECT toString(count(*)) AS cnt
        FROM final_event_log
        WHERE \`$event_name\` = {eventName:String}
          AND \`$service_time\` >= now() - INTERVAL {windowMinutes:UInt32} MINUTE
      `, {
        eventName: rule.eventName,
        windowMinutes: Math.max(Math.floor(rule.windowMinutes || 60), 1),
      })

      const metricValue = parseInt(rows?.[0]?.cnt || '0', 10)
      rule.lastCheckedAt = now

      if (!this.compare(metricValue, rule.operator!, Number(rule.threshold))) {
        await this.alertRuleRepo.save(rule)
        return
      }

      // 触发告警：发送 Webhook 通知并记录历史
      const { status, error } = await this.sendWebhook(rule, metricValue, now)

      rule.lastTriggeredAt = now
      await this.alertRuleRepo.save(rule)

      await this.alertHistoryRepo.save(this.alertHistoryRepo.create({
        ruleId: Number(rule.id),
        metricValue,
        threshold: Number(rule.threshold),
        level: rule.level,
        webhookStatus: status,
        error,
      }))

      this.logger.log(`告警规则 ${rule.id}（${rule.name}）触发：${rule.eventName} ${rule.operator} ${rule.threshold}，当前值 ${metricValue}，webhook ${status}`)
    } catch (error) {
      this.logger.error(`巡检告警规则 ${rule.id}（${rule.name}）失败`, error)
    }
  }

  /**
   * 发送 Webhook 通知（5s 超时，失败重试 1 次）
   */
  private async sendWebhook(rule: AlertRuleEntity, metricValue: number, now: Date): Promise<{ status: AlertWebhookStatus; error?: string }> {
    const payload: IAlertWebhookPayload = {
      ruleId: Number(rule.id),
      ruleName: rule.name!,
      eventName: rule.eventName!,
      windowMinutes: rule.windowMinutes!,
      operator: rule.operator!,
      threshold: Number(rule.threshold),
      metricValue,
      level: rule.level!,
      triggeredAt: now.toISOString(),
    }

    let lastError: string | undefined
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await axios.post(rule.webhookUrl!, payload, { timeout: 5000 })
        return { status: 'success' }
      } catch (error) {
        lastError = error?.message || 'Webhook 请求失败'
        this.logger.warn(`告警规则 ${rule.id} Webhook 第 ${attempt + 1} 次发送失败：${lastError}`)
      }
    }
    return { status: 'failed', error: lastError }
  }

  /**
   * 按运算符比较指标值与阈值
   */
  private compare(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>':
        return value > threshold
      case '<':
        return value < threshold
      case '>=':
        return value >= threshold
      case '<=':
        return value <= threshold
      case '==':
        return value === threshold
      default:
        return false
    }
  }
}
