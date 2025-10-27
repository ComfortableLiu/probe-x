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
    const requiredList: Array<keyof IEvent> = ['$event_name', '$web_site', '$device_id', '$log_time', '$zoon']

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
      $event_name: data.eventName,
      $ip: data.ip,
      $ua: data.ua,

      $web_params: data.webParams || '',
      $web_site: data.webSite || '',
      $web_pathname: data.webPathname || '',

      $device_id: data.deviceId,

      $referrer: data.referrer || '',

      $utm_term: data.utmTerm || '',
      $utm_campaign: data.utmCampaign || '',
      $utm_content: data.utmContent || '',
      $utm_source: data.utmSource || '',
      $utm_medium: data.utmMedium || '',

      $log_time: data.logTime ? new Date(data.logTime) : new Date(),
      $service_time: new Date(),
      $screen_width: data.screenWidth || -1,
      $screen_height: data.screenHeight || -1,
      $device_pixel_ratio: data.pixelRatio || -1,
      $device: data.device || '',
      $element_id: data.elementId || '',
      $uid: data.uid || -1,
      $language: data.language || '',
      $scroll_height: data.scrollHeight || -1,
      $viewport_height: data.viewportHeight || -1,
      $viewport_width: data.viewportWidth || -1,
      $zoon: data.$zoon || -1,
      // 最后把业务参数直接放到event中
      ...data.data,
    }

    // 保存到数据库
    this.clickHouseService.insert<IEvent>('event', [event])
    // TODO 用kafka通知初步清洗服务
    return true
  }
}
