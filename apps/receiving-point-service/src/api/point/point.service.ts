import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Event } from '@entity/event.entity'
import { IAnyObj } from "@shared-types"

@Injectable()
export class PointService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {
  }

  private validateBeaconData(data: any): { isValid: boolean; errors: string[] } {
    const requiredList: Array<keyof Event> = ['eventName', 'site', 'ip', 'deviceId', 'logTime', 'path', 'ua']

    const errors: string[] = requiredList.map(key => {
      if (!data[key] || typeof data.eventName !== 'string' || data.eventName.trim() === '') {
        return `${key} is required and must be a non-empty string`
      }
      return ''
    }).filter(Boolean)

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  saveBeaconData(data: IAnyObj) {
    // 校验必需参数
    const validation = this.validateBeaconData(data)
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join('\n')}`)
    }

    // 创建Event实体实例
    const event = new Event()

    // 根据传入的数据填充实体字段，这里明确协定的目的是为了可精细化管理，去管理每一个公参的逻辑
    event.eventName = data.eventName
    event.ip = data.ip
    event.ua = data.ua

    event.site = data.site
    event.path = data.path
    event.params = data.params || ''

    event.deviceId = data.deviceId

    event.referrer = data.referrer || ''

    event.utmTerm = data.utmTerm || ''
    event.utmCampaign = data.utmCampaign || ''
    event.utmContent = data.utmContent || ''
    event.utmSource = data.utmSource || ''
    event.utmMedium = data.utmMedium || ''

    event.logTime = data.logTime ? new Date(data.logTime) : new Date()
    event.serviceTime = new Date()

    // 最后把业务参数直接放到event中
    Object.assign(event, data.data)

    // 保存到数据库
    return this.eventRepository.save(event)
  }
}
