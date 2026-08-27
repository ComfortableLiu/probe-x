import { Inject, Injectable } from '@nestjs/common'
import type { IAnyObj, IEventLog } from "@probe-x/shared-types/src"
import { TOPIC_PRELIMINARY_DATA_PROCESSING_POINT_META } from "@probe-x/shared-types/src"
import { ClientKafka } from "@nestjs/microservices"
import { firstValueFrom } from "rxjs"
import { v4 as uuidv4 } from "uuid"

@Injectable()
export class PointService {
  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientKafka,
  ) {
  }

  async onModuleInit() {
    await this.kafkaClient.connect()
  }

  private validateBeaconData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查必需字段
    if (!data.eventName || typeof data.eventName !== 'string' || data.eventName.trim() === '') {
      errors.push('eventName is required and must be a non-empty string')
    }
    if (!data.webSite || typeof data.webSite !== 'string' || data.webSite.trim() === '') {
      errors.push('webSite is required and must be a non-empty string')
    }
    if (!data.deviceId || typeof data.deviceId !== 'string' || data.deviceId.trim() === '') {
      errors.push('deviceId is required and must be a non-empty string')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  saveBeaconData(data: IAnyObj) {
    // 处理批量数据（SDK发送的格式）
    if (data.events && Array.isArray(data.events)) {
      // 批量处理，Promise.allSettled 逐条隔离失败
      const events: any[] = data.events
      return Promise.allSettled(events.map((event: any) => {
        const eventData = {
          ...event,
          ip: data.ip || event.ip,
          ua: data.ua || event.ua,
        }
        return this.saveSingleEvent(eventData)
      })).then((results) => {
        // 收集失败条目，在响应中报告
        const failed = results
          .map((result, index) => ({ result, index }))
          .filter(({ result }) => result.status === 'rejected')
          .map(({ result, index }) => ({
            index,
            eventName: events[index]?.eventName || '',
            error: (result as PromiseRejectedResult).reason instanceof Error
              ? (result as PromiseRejectedResult).reason.message
              : String((result as PromiseRejectedResult).reason),
          }))
        if (failed.length > 0) {
          throw new Error(
            `部分事件上报失败（${failed.length}/${results.length}）: ` +
            failed.map(item => `#${item.index} ${item.eventName}: ${item.error}`).join('; '),
          )
        }
        return true
      })
    } else {
      // 单个事件处理
      return this.saveSingleEvent(data)
    }
  }

  private async saveSingleEvent(data: IAnyObj) {
    // 校验必需参数
    const validation = this.validateBeaconData(data)
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join('\n')}`)
    }

    // 创建Event实体实例
    const event: IEventLog = {
      // 根据传入的数据填充实体字段，这里明确协定的目的是为了可精细化管理，去管理每一个公参的逻辑
      // 端到端幂等去重键，SDK 生成并透传；旧版 SDK 未携带时在接收端生成兜底
      $event_id: data.$event_id || uuidv4(),
      $event_name: data.eventName,
      $ip: data.ip || '',
      $ua: data.ua || '',

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
      $zoon: data.zoon || data.$zoon || -1,
      // 最后把业务参数直接放到event中
      ...(data.data || {}),
    }

    // 用kafka通知初步清洗服务，await 确保消息送达
    // 以 deviceId 作为 message key，保证同设备的消息进入同一 partition，消费侧有序
    await firstValueFrom(
      this.kafkaClient.emit(TOPIC_PRELIMINARY_DATA_PROCESSING_POINT_META, {
        key: event.$device_id,
        value: event,
      }),
    )
    return true
  }
}
