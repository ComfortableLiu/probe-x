import { Injectable, OnApplicationShutdown, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { IEventLog, IPreEventLog, IUserCacheData, TrackingNodeLevel, TrackingNodeType } from "@probe-x/shared-types/src"
import { ClickHouseService, RedisService, TrackingNodeEntity } from "@probe-x/shared-utils/src/lib/backend-common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import dayjs from "dayjs"
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  // 批量聚合阈值：达到条数立即 flush
  private static readonly FLUSH_BATCH_SIZE = 500
  // 批量聚合时间窗口：先到先发
  private static readonly FLUSH_INTERVAL_MS = 5000

  // 待写入 event_log 的内存缓冲区
  private eventBuffer: IPreEventLog[] = []
  private flushTimer: NodeJS.Timeout | null = null
  // 正在进行的 flush，避免并发 flush 和退出时丢数据
  private pendingFlush: Promise<void> | null = null

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectRepository(TrackingNodeEntity)
    private trackingNodeRepository: Repository<TrackingNodeEntity>,
  ) {
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
   * 把缓冲区数据批量写入 event_log，失败时数据放回缓冲区等待下次重试
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
    this.pendingFlush = this.clickhouseService.insert('event_log', batch)
      .then(() => undefined)
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
   * 补充scm/spm信息，TODO 没验证
   * @param data
   */
  async completeSpmAndScm(data: IEventLog) {
    const spmList = data.$spm?.split('.') || []
    const scmList = data.$scm?.split('.') || []

    // 查数据库，查出来spm和scm数组里面所有的值是什么
    const queryBuilder = this.trackingNodeRepository.createQueryBuilder()
    const level = [TrackingNodeLevel.LEVEL1, TrackingNodeLevel.LEVEL2, TrackingNodeLevel.LEVEL3, TrackingNodeLevel.LEVEL4]
    const type = [TrackingNodeType.SPM, TrackingNodeType.SCM]

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const data = (j === 0 ? spmList : scmList)
        if (!data[i]) continue

        const where = {
          type: type[j],
          level: level[i],
          code: data[i],
        }
        if (data[i - 1]) {
          where['parentCode'] = data[i - 1]
        }
        queryBuilder.orWhere(where)
      }
    }
    const res = await queryBuilder.getMany()
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
        updatedAt: data.$service_time,
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
        updatedAt: data.$service_time,
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
        updatedAt: data.$service_time,
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
   * @param event
   */
  async handleEvent(event: IEventLog) {
    try {
      // 端到端幂等：SDK 重试 / Kafka 重投产生的重复事件只处理一次，
      // 去重判定在进入缓冲区前完成；SET NX EX 86400 已存在则跳过
      // $event_id 缺失（旧 SDK/兜底未覆盖）时用 deviceId+eventName+logTime 哈希兜底
      const dedupId = event.$event_id || createHash('md5')
        .update(`${event.$device_id}|${event.$event_name}|${event.$log_time}`)
        .digest('hex')
      const isNewEvent = await this.redisService.setNx(`dedup:event:${dedupId}`, '1', 86400)
      if (!isNewEvent) {
        console.debug(`重复事件跳过: ${dedupId} (${event.$event_name})`)
        return
      }

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
        ...utmInfo,
        $session_id: sessionId,
      }
      // TODO 这里字段名没有转下划线格式
      // 进入内存缓冲区，按条数（500）或时间窗口（5s）批量落库，先到先发
      this.eventBuffer.push(data)
      if (this.eventBuffer.length >= KafkaConsumerService.FLUSH_BATCH_SIZE) {
        await this.flushEventLog()
      }
      // TODO 通知在线清洗服务，一期不实现
    } catch (e) {
      // 可重试错误（连接/超时类）rethrow，让 Kafka 重投
      if (this.isRetryableError(e)) {
        throw e
      }
      // 脏数据：记录 error_log 后正常返回，offset 正常提交，不阻塞后续消息
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
    }
  }
}
