import { Body, Controller, Headers, Post, Req } from '@nestjs/common'
import { PointService } from './point.service'
import { Request } from 'express'
import { ResponseData } from "@probe-x/shared-utils/src/lib/backend-common"

@Controller('/point')
export class PointController {
  constructor(private readonly pointService: PointService) {
  }

  @Post('/report')
  async handleBeacon(
    @Body() data: any,
    @Req() req: Request,
    @Headers('Content-Type') contentType: string,
  ) {
    // 处理来自Beacon API的数据上报
    let beaconData: any

    if (contentType && contentType.includes('application/json')) {
      // 已经被自动解析为JSON
      beaconData = data
    } else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
      // 表单数据
      beaconData = req.body
    } else {
      // 文本或其他格式的数据，可能需要从流中读取
      // 这种情况下，data可能是一个字符串
      beaconData = typeof data === 'string' ? data : req.body
    }

    const ua = req.header('user-agent')
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.ip

    const eventData = {
      ...beaconData,
      ua,
      ip,
    }

    try {
      await this.pointService.saveBeaconData(eventData)
    } catch (e) {
      return ResponseData.error((e as Error).message)
    }
    // 返回成功响应
    return true
  }
}
