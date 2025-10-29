import { Injectable } from '@nestjs/common'
import { IEventLog, IPreEventLog, IUserCacheData, TrackingNodeLevel, TrackingNodeType } from "@probe-x/shared-types/src"
import { ClickHouseService, RedisService, TrackingNodeEntity } from "@probe-x/shared-utils/src/lib/backend-common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import dayjs from "dayjs"
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class KafkaConsumerService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectRepository(TrackingNodeEntity)
    private trackingNodeRepository: Repository<TrackingNodeEntity>,
  ) {
  }

  /**
   * 补充scm/spm信息，TODO 没验证
   * @param data
   */
  async completeSpmAndScm(data: IEventLog) {
    const spmList = data.$spm?.split('.')
    const scmList = data.$scm?.split('.')

    // 查数据库，查出来spm和scm数组里面所有的值是什么
    const queryBuilder = this.trackingNodeRepository.createQueryBuilder()
    const level = [TrackingNodeLevel.LEVEL1, TrackingNodeLevel.LEVEL2, TrackingNodeLevel.LEVEL3, TrackingNodeLevel.LEVEL4]
    const type = [TrackingNodeType.SPM, TrackingNodeType.SCM]

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const data = (j === 0 ? spmList : scmList)
        if (data[i]) continue

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

    // 异常边界，如果这次的时间比上次更新时间早，就直接返回上次的SessionId
    if (dayjs(userCacheData.updatedAt).isAfter(data.$service_time)) {
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
        $sessionId: sessionId,
      }
      // 保存到数据库
      await this.clickhouseService.insert('event_log', [data])
      // TODO 通知在线清洗服务，一期不实现
    } catch (e) {
      await this.clickhouseService.insert('error_log', [{
        data: JSON.stringify({
          event,
        }),
        error_log: JSON.stringify(e || {}),
        service_key: 'kafka-consumer.service -> handleEvent',
        create_date: new Date(),
      }])
    }
  }
}
