import { Injectable, OnApplicationShutdown, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { IEventLog, IPreEventLog, IUserCacheData, TrackingNodeLevel, TrackingNodeType } from "@probe-x/shared-types/src"
import { ClickHouseService, RedisService, TrackingNodeEntity } from "@probe-x/shared-utils/src/lib/backend-common"
import { recordPreliminaryCleaningOutcome } from "@probe-x/shared-utils/src/lib/backend-common/runtime-metrics"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import dayjs from "dayjs"
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'

// 单条消息的 Kafka 位点，用于按分区跟踪消费进度
interface EventMeta {
  topic: string
  partition: number
  offset: number
}

// 内存缓冲区元素：补全后的事件 + 位点
interface BufferedEvent {
  event: IPreEventLog
  meta: EventMeta
}

// offset 提交能力，由 controller 从 KafkaContext 注入（context.getConsumer().commitOffsets）
type OffsetCommitter = (offsets: { topic: string; partition: number; offset: string }[]) => Promise<void>

// 单个分区的消费进度
interface PartitionProgress {
  topic: string
  partition: number
  // 已完成但尚未连成连续前缀的 offset（连成前缀后逐个移除）
  completed: Set<number>
  // 下一个待完成的 offset，之前的 offset 均已完成
  nextOffset: number
  // 上次已提交到 Kafka 的位点，避免重复提交
  committed: number | null
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  // 批量聚合阈值：达到条数立即 flush
  private static readonly FLUSH_BATCH_SIZE = 500
  // 批量聚合时间窗口：先到先发
  private static readonly FLUSH_INTERVAL_MS = 5000

  // 待写入 event_log 的内存缓冲区
  private eventBuffer: BufferedEvent[] = []
  private flushTimer: NodeJS.Timeout | null = null
  // 正在进行的 flush，避免并发 flush 和退出时丢数据
  private pendingFlush: Promise<void> | null = null
  // 按 ${topic}:${partition} 记录各 offset 完成状态与已提交位点
  private partitionProgress = new Map<string, PartitionProgress>()
  // 最近一次消费传入的提交能力（同一 consumer，可提交任意分区的位点）
  private offsetCommitter: OffsetCommitter | null = null
  private lastMetricsWarningAt: number | null = null

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectRepository(TrackingNodeEntity)
    private trackingNodeRepository: Repository<TrackingNodeEntity>,
  ) {
  }

  // 监控故障不得改变消费、落库、offset 提交或重试结果；最多每分钟告警一次。
  private recordCleaningOutcome(success: boolean, count: number) {
    const recordedAt = Date.now()
    void Promise.resolve().then(() => recordPreliminaryCleaningOutcome(this.redisService.getClient(), success, count, recordedAt))
      .catch(() => {
        const now = Date.now()
        if (this.lastMetricsWarningAt === null || now - this.lastMetricsWarningAt >= 60000) {
          this.lastMetricsWarningAt = now
          console.warn('初次清洗结果监控写入失败，业务处理继续')
        }
      })
  }

  onModuleInit() {
    // 时间窗口 flush，条数阈值在 handleEvent 中判断
    this.flushTimer = setInterval(() => {
      this.flushEventLog().catch((e) => {
        console.error('定时 flush event_log 失败，数据保留在缓冲区等待重试:', e)
      })
    }, KafkaConsumerService.FLUSH_INTERVAL_MS)
  }

  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  async onApplicationShutdown() {
    // 进程关闭前把缓冲区剩余数据 flush 掉（配合 main.ts 的 enableShutdownHooks）
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    // 等待正在进行的 flush 完成后再 flush 剩余数据
    await this.pendingFlush?.catch(() => undefined)
    await this.flushEventLog().catch((e) => {
      console.error('进程关闭前 flush event_log 失败:', e)
    })
  }

  /**
   * 把缓冲区数据批量写入 event_log，失败时数据放回缓冲区等待下次重试；
   * 写入成功后推进各分区连续完成前缀并提交 offset
   */
  private flushEventLog(): Promise<void> {
    if (this.pendingFlush) {
      return this.pendingFlush
    }
    if (this.eventBuffer.length === 0) {
      return Promise.resolve()
    }
    const batch = this.eventBuffer
    this.eventBuffer = []
    this.pendingFlush = this.flushBatch(batch)
      .catch((e) => {
        // 写回缓冲区头部，保证数据不丢、顺序不乱
        this.eventBuffer = batch.concat(this.eventBuffer)
        throw e
      })
      .finally(() => {
        this.pendingFlush = null
      })
    return this.pendingFlush
  }

  /**
   * 单批次落库：先逐条 SET NX 去重（已存在则丢弃该条，其 offset 仍计完成），
   * 插入成功后推进各分区连续完成前缀并提交；失败时 DEL 本次新占用的去重键，不提交 offset
   */
  private async flushBatch(batch: BufferedEvent[]): Promise<void> {
    // 端到端幂等：SDK 重试 / Kafka 重投产生的重复事件只插入一次，
    // 去重判定在落库前完成；SET NX EX 86400 已存在则丢弃
    // $event_id 缺失（旧 SDK/兜底未覆盖）时用 deviceId+eventName+logTime 哈希兜底
    const acquiredKeys: string[] = []
    const newEvents: IPreEventLog[] = []
    let pendingEvents = batch.length
    try {
      for (const { event } of batch) {
        const dedupId = event.$event_id || createHash('md5')
          .update(`${event.$device_id}|${event.$event_name}|${event.$log_time}`)
          .digest('hex')
        const dedupKey = `dedup:event:${dedupId}`
        const isNewEvent = await this.redisService.setNx(dedupKey, '1', 86400)
        if (isNewEvent) {
          acquiredKeys.push(dedupKey)
          newEvents.push(event)
        } else {
          pendingEvents--
          console.debug(`重复事件跳过: ${dedupId} (${event.$event_name})`)
        }
      }
      if (newEvents.length > 0) {
        await this.clickhouseService.insert('event_log', newEvents)
      }
    } catch (e) {
      this.recordCleaningOutcome(false, pendingEvents)
      // 失败时释放本次新占用的去重键，避免重投被误判重复；批次由调用方回缓冲头部
      await this.releaseDedupKeys(acquiredKeys)
      throw e
    }
    if (newEvents.length > 0) this.recordCleaningOutcome(true, newEvents.length)

    // 落库成功：批内所有 offset（含被去重丢弃的）都计为完成，并提交有推进的分区位点
    for (const { meta } of batch) {
      this.markOffsetCompleted(meta)
    }
    for (const progress of this.partitionProgress.values()) {
      await this.commitProgress(progress)
    }
  }

  // 释放去重键，单个失败仅打日志（残留键有过期时间，最坏情况是重投被去重丢弃）
  private async releaseDedupKeys(keys: string[]) {
    for (const key of keys) {
      await this.redisService.del(key).catch((e) => {
        console.error(`释放去重键失败 (${key}):`, e)
      })
    }
  }

  // 记录某条消息完成并推进所在分区的连续已完成前缀，返回有推进的分区进度（无推进返回 null）
  private markOffsetCompleted(meta: EventMeta): PartitionProgress | null {
    const key = `${meta.topic}:${meta.partition}`
    let progress = this.partitionProgress.get(key)
    if (!progress) {
      progress = {
        topic: meta.topic,
        partition: meta.partition,
        completed: new Set(),
        nextOffset: meta.offset,
        committed: null,
      }
      this.partitionProgress.set(key, progress)
    }
    // 早于连续前缀的重投不影响推进
    if (meta.offset >= progress.nextOffset) {
      progress.completed.add(meta.offset)
    }
    const before = progress.nextOffset
    while (progress.completed.delete(progress.nextOffset)) {
      progress.nextOffset++
    }
    return progress.nextOffset > before ? progress : null
  }

  // 提交分区推进后的位点（Kafka 提交语义为「下一条待消费 offset」）；
  // 提交失败仅打日志（committed 不推进），后续 flush 会重试
  private async commitProgress(progress: PartitionProgress) {
    if (!this.offsetCommitter || progress.committed === progress.nextOffset) return
    try {
      await this.offsetCommitter([{
        topic: progress.topic,
        partition: progress.partition,
        offset: String(progress.nextOffset),
      }])
      progress.committed = progress.nextOffset
    } catch (e) {
      console.error(`提交 offset 失败 (${progress.topic}:${progress.partition}@${progress.nextOffset}):`, e)
    }
  }

  /**
   * 判断是否是可重试错误（ClickHouse/Redis/MySQL 连接、超时类），
   * 可重试错误 rethrow 让 Kafka 重投，脏数据记 error_log 后正常提交
   */
  private isRetryableError(e: unknown): boolean {
    const message = (e instanceof Error ? `${e.message}\n${e.stack || ''}` : String(e)).toLowerCase()
    const retryableKeywords = [
      'econnrefused',
      'econnreset',
      'etimedout',
      'epipe',
      'socket hang up',
      'connect timeout',
      'timeout',
      'network',
      'service unavailable',
      'connection',
    ]
    return retryableKeywords.some(keyword => message.includes(keyword))
  }

  /**
   * 补充scm/spm信息
   * 编码按「位置即层级」解析：第 N 段恒对应第 N 层；
   * 空维度保留句点占位（如 A..C.、A...D），空段跳过不查库
   * @param data
   */
  async completeSpmAndScm(data: IEventLog) {
    // $spm/$scm 缺失或为空字符串都按空列表处理（''.split('.') 会得到 ['']）
    const spmList = data.$spm ? data.$spm.split('.') : []
    const scmList = data.$scm ? data.$scm.split('.') : []

    // spm 和 scm 都为空时不查库：不加任何 WHERE 条件的 getMany 会全表扫描 tracking_node
    let res: TrackingNodeEntity[] = []
    if (spmList.length > 0 || scmList.length > 0) {
      // 查数据库，查出来spm和scm数组里面所有的值是什么
      const queryBuilder = this.trackingNodeRepository.createQueryBuilder()
      const level = [TrackingNodeLevel.LEVEL1, TrackingNodeLevel.LEVEL2, TrackingNodeLevel.LEVEL3, TrackingNodeLevel.LEVEL4]
      const type = [TrackingNodeType.SPM, TrackingNodeType.SCM]

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
          const segments = (j === 0 ? spmList : scmList)
          if (!segments[i]) continue

          const where = {
            type: type[j],
            level: level[i],
            code: segments[i],
          }
          if (segments[i - 1]) {
            where['parentCode'] = segments[i - 1]
          }
          queryBuilder.orWhere(where)
        }
      }
      res = await queryBuilder.getMany()
    }
    const dist = new Map()
    res.forEach(item => {
      dist.set(`${item.type}-${item.level}-${item.code}`, item)
    })

    return {
      $spm_a: dist.get(`${TrackingNodeType.SPM}-${TrackingNodeLevel.LEVEL1}-${spmList[0]}`)?.name || '',
      $spm_a_description: dist.get(`${TrackingNodeType.SPM}-${TrackingNodeLevel.LEVEL1}-${spmList[0]}`)?.description || '',
      $spm_b: dist.get(`${TrackingNodeType.SPM}-${TrackingNodeLevel.LEVEL2}-${spmList[1]}`)?.name || '',
      $spm_b_description: dist.get(`${TrackingNodeType.SPM}-${TrackingNodeLevel.LEVEL2}-${spmList[1]}`)?.description || '',
      $spm_c: dist.get(`${TrackingNodeType.SPM}-${TrackingNodeLevel.LEVEL3}-${spmList[2]}`)?.name || '',
      $spm_c_description: dist.get(`${TrackingNodeType.SPM}-${TrackingNodeLevel.LEVEL3}-${spmList[2]}`)?.description || '',
      $spm_d: dist.get(`${TrackingNodeType.SPM}-${TrackingNodeLevel.LEVEL4}-${spmList[3]}`)?.name || '',
      $spm_d_description: dist.get(`${TrackingNodeType.SPM}-${TrackingNodeLevel.LEVEL4}-${spmList[3]}`)?.description || '',

      $scm_a: dist.get(`${TrackingNodeType.SCM}-${TrackingNodeLevel.LEVEL1}-${scmList[0]}`)?.name || '',
      $scm_a_description: dist.get(`${TrackingNodeType.SCM}-${TrackingNodeLevel.LEVEL1}-${scmList[0]}`)?.description || '',
      $scm_b: dist.get(`${TrackingNodeType.SCM}-${TrackingNodeLevel.LEVEL2}-${scmList[1]}`)?.name || '',
      $scm_b_description: dist.get(`${TrackingNodeType.SCM}-${TrackingNodeLevel.LEVEL2}-${scmList[1]}`)?.description || '',
      $scm_c: dist.get(`${TrackingNodeType.SCM}-${TrackingNodeLevel.LEVEL3}-${scmList[2]}`)?.name || '',
      $scm_c_description: dist.get(`${TrackingNodeType.SCM}-${TrackingNodeLevel.LEVEL3}-${scmList[2]}`)?.description || '',
      $scm_d: dist.get(`${TrackingNodeType.SCM}-${TrackingNodeLevel.LEVEL4}-${scmList[3]}`)?.name || '',
      $scm_d_description: dist.get(`${TrackingNodeType.SCM}-${TrackingNodeLevel.LEVEL4}-${scmList[3]}`)?.description || '',
    }
  }

  /**
   * Session切割&utm补充，TODO 没验证
   * @param data
   */
  async splitSessionAndUtm(data: IEventLog) {
    const deviceId = data.$device_id
    const userCacheData = await this.redisService.get<IUserCacheData>(deviceId)

    const sessionId = userCacheData?.sessionId
    const utmInfo = {
      utmContent: data.$utm_content,
      utmMedium: data.$utm_medium,
      utmSource: data.$utm_source,
      utmTerm: data.$utm_term,
      utmCampaign: data.$utm_campaign,
    }

    // 如果没有缓存，那就全新的session并缓存
    if (!userCacheData) {
      const userData: IUserCacheData = {
        ...utmInfo,
        sessionId: uuidv4(),
        deviceId,
        updatedAt: data.$service_time as string,
      }
      await this.redisService.set(deviceId, userData, 40 * 60)
      return {
        sessionId: userData.sessionId,
        utmInfo,
      }
    }

    // 异常边界，如果这次的时间比上次更新时间早，就直接返回上次的SessionId，utm也从缓存回填
    if (dayjs(userCacheData.updatedAt).isAfter(data.$service_time)) {
      utmInfo.utmContent = userCacheData.utmContent
      utmInfo.utmMedium = userCacheData.utmMedium
      utmInfo.utmSource = userCacheData.utmSource
      utmInfo.utmTerm = userCacheData.utmTerm
      utmInfo.utmCampaign = userCacheData.utmCampaign
      return {
        sessionId,
        utmInfo,
      }
    }
    // 相差半小时以上
    const serviceTime = dayjs(data.$service_time)
    const lastUpdateTime = dayjs(userCacheData.updatedAt)
    // 相差半小时以上，就新建Session
    if (serviceTime.diff(lastUpdateTime, 'minute') > 30) {
      const userData: IUserCacheData = {
        ...utmInfo,
        sessionId: uuidv4(),
        deviceId,
        updatedAt: data.$service_time as string,
      }
      await this.redisService.set(deviceId, userData, 40 * 60)
      return {
        sessionId: userData.sessionId,
        utmInfo,
      }
    }

    // 如果utmInfo中的值与上次缓存的值不一致，并且本次不是全空，就新建session
    if (Object.values(utmInfo).some(item => item) &&
      Object.entries(utmInfo).some(([key, value]) => userCacheData[key] !== value)) {
      const userData: IUserCacheData = {
        ...utmInfo,
        sessionId: uuidv4(),
        deviceId,
        updatedAt: data.$service_time as string,
      }
      await this.redisService.set(deviceId, userData, 40 * 60)
      return {
        sessionId: userData.sessionId,
        utmInfo,
      }
    }

    utmInfo.utmContent = userCacheData.utmContent
    utmInfo.utmMedium = userCacheData.utmMedium
    utmInfo.utmSource = userCacheData.utmSource
    utmInfo.utmTerm = userCacheData.utmTerm
    utmInfo.utmCampaign = userCacheData.utmCampaign

    await this.redisService.set(deviceId, {
      ...utmInfo,
      sessionId,
      deviceId,
      updatedAt: data.$service_time,
    }, 40 * 60)
    return {
      sessionId,
      utmInfo,
    }
  }

  /**
   * 补充各种信息
   * TODO 可以优化，多线程，但是需要保证同 deviceId 的顺序
   * @param event 原始事件
   * @param meta 消息的 Kafka 位点（topic/partition/offset）
   * @param commitOffsets offset 提交能力（绑定 KafkaContext 的 consumer）
   */
  async handleEvent(event: IEventLog, meta: EventMeta, commitOffsets: OffsetCommitter) {
    this.offsetCommitter = commitOffsets
    let buffered = false
    try {
      const res = await Promise.all([
        this.splitSessionAndUtm(event),
        this.completeSpmAndScm(event),
      ])

      const [{
        sessionId,
        utmInfo,
      }, scmSpmInfo] = res

      const data: IPreEventLog = {
        ...event,
        ...scmSpmInfo,
        // utm 用 session 回填后的值覆盖，键名与 event_log 的 $utm_* 列对齐；
        // 回填值缺失（undefined）时保留事件原始值，避免把已有值覆盖成空
        $utm_content: utmInfo.utmContent ?? event.$utm_content,
        $utm_medium: utmInfo.utmMedium ?? event.$utm_medium,
        $utm_source: utmInfo.utmSource ?? event.$utm_source,
        $utm_term: utmInfo.utmTerm ?? event.$utm_term,
        $utm_campaign: utmInfo.utmCampaign ?? event.$utm_campaign,
        $session_id: sessionId,
      }
      // 进入内存缓冲区，按条数（500）或时间窗口（5s）批量落库，先到先发；
      // offset 只在落库成功后才提交，崩溃时缓冲区数据随 Kafka 重投恢复，由落库前去重保证幂等
      this.eventBuffer.push({ event: data, meta })
      buffered = true
      if (this.eventBuffer.length >= KafkaConsumerService.FLUSH_BATCH_SIZE) {
        await this.flushEventLog()
      }
      // TODO 通知在线清洗服务，一期不实现
    } catch (e) {
      // flushBatch 已统计整批失败；补全阶段失败仅统计当前事件一次。
      if (!buffered) this.recordCleaningOutcome(false, 1)
      // 可重试错误（连接/超时类）rethrow，不推进 offset，让 Kafka 重投
      if (this.isRetryableError(e)) {
        throw e
      }
      // 脏数据：记录 error_log 后把该 offset 标记为已完成并提交，不阻塞后续消息
      try {
        await this.clickhouseService.insert('error_log', [{
          data: JSON.stringify({
            event,
          }),
          // JSON.stringify(Error) 会丢失 message/stack，这里显式序列化
          error_log: e instanceof Error
            ? JSON.stringify({ message: e.message, stack: e.stack })
            : String(e),
          service_key: 'kafka-consumer.service -> handleEvent',
          create_date: new Date(),
        }])
      } catch (logError) {
        // error_log 写不进去时不能影响消费流程，打日志即可
        console.error('写入 error_log 失败:', logError)
      }
      const progress = this.markOffsetCompleted(meta)
      if (progress) {
        await this.commitProgress(progress)
      }
    }
  }
}
