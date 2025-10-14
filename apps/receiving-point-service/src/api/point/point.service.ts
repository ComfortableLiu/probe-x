import { Injectable } from '@nestjs/common'
import { IAnyObj } from "@probe-x/shared-types/src"
import { IEvent } from "@entity/event.entity"
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"

@Injectable()
export class PointService {
  constructor(
    private readonly clickHouseService: ClickHouseService,
  ) {
  }

  private validateBeaconData(data: any): { isValid: boolean; errors: string[] } {
    const requiredList: Array<keyof IEvent> = ['eventName', 'site', 'ip', 'deviceId', 'logTime', 'path', 'ua']

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
    const event: IEvent = {
      // 根据传入的数据填充实体字段，这里明确协定的目的是为了可精细化管理，去管理每一个公参的逻辑
      eventName: data.eventName,
      ip: data.ip,
      ua: data.ua,

      webParams: data.webParams || '',
      webSite: data.webSite || '',
      webPathname: data.webPathname || '',

      deviceId: data.deviceId,

      referrer: data.referrer || '',

      utmTerm: data.utmTerm || '',
      utmCampaign: data.utmCampaign || '',
      utmContent: data.utmContent || '',
      utmSource: data.utmSource || '',
      utmMedium: data.utmMedium || '',

      logTime: data.logTime ? new Date(data.logTime) : new Date(),
      serviceTime: new Date(),
      screenWidth: data.screenWidth || -1,
      screenHeight: data.screenHeight || -1,
      devicePixelRatio: data.pixelRatio || -1,
      device: data.device || '',
      elementId: data.elementId || '',
      uid: data.uid || -1,
      language: data.language || '',
      scrollHeight: data.scrollHeight || -1,
      viewportHeight: data.viewportHeight || -1,
      viewportWidth: data.viewportWidth || -1,
      zoom: data.zoom || -1,

      // 最后把业务参数直接放到event中
      ...data.data,
    }

    // 保存到数据库
    return this.clickHouseService.insert<IEvent>('event', [event])
    // return this.eventRepository.save(event)
  }
}
