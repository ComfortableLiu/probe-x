import { Body, Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common'
import { PointService } from './point.service'
import { Request, Response } from 'express'
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
    // 处理来自Beacon API、fetch、XMLHttpRequest的数据上报
    let beaconData: any

    if (contentType && contentType.includes('application/json')) {
      // 已经被自动解析为JSON
      beaconData = data
    } else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
      // 表单数据
      beaconData = req.body
    } else if (contentType && contentType.includes('text/plain')) {
      // sendBeacon 可能发送 text/plain 格式
      try {
        beaconData = typeof data === 'string' ? JSON.parse(data) : data
      } catch (e) {
        // 如果解析失败，尝试从原始body读取
        beaconData = req.body
      }
    } else {
      // 其他格式，尝试解析
      try {
        beaconData = typeof data === 'string' ? JSON.parse(data) : (data || req.body)
      } catch (e) {
        beaconData = req.body || data
      }
    }

    const ua = req.header('user-agent')
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.ip

    // 如果 beaconData 是批量数据（包含 events 数组），将 ip 和 ua 添加到顶层
    // 如果 beaconData 是单个事件，直接合并
    const eventData = {
      ...beaconData,
      ip: beaconData.ip || ip,
      ua: beaconData.ua || ua,
    }

    try {
      await this.pointService.saveBeaconData(eventData)
    } catch (e) {
      throw ResponseData.error((e as Error).message)
    }
    // 返回成功响应
    return true
  }

  @Get('/track.gif')
  async handleGifRequest(
    @Query('data') dataParam: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 处理来自gif图片请求的数据上报（最终降级方案）
    try {
      let beaconData: any

      if (dataParam) {
        try {
          // 尝试解析Base64编码的数据
          try {
            // 使用 Buffer 进行 Base64 解码（Node.js 环境）
            const decoded = Buffer.from(dataParam, 'base64').toString('utf-8')
            beaconData = JSON.parse(decodeURIComponent(decoded))
          } catch {
            // 如果不是Base64，直接解析JSON
            beaconData = JSON.parse(dataParam)
          }
        } catch (parseError) {
          // 解析失败，记录错误但继续处理
          console.error('Failed to parse gif request data:', parseError)
          beaconData = {}
        }
      }

      const ua = req.header('user-agent')
      const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.ip

      const eventData = {
        ua,
        ip,
        ...beaconData,
      }

      // 异步处理数据，不阻塞响应
      this.pointService.saveBeaconData(eventData).catch((e) => {
        console.error('Failed to save gif request data:', e)
      })

      // 返回1x1透明GIF图片
      // GIF89a 是GIF文件头，后面是1x1透明像素的数据
      const gifBuffer = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
      )

      res.setHeader('Content-Type', 'image/gif')
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.send(gifBuffer)
    } catch (e) {
      // 即使出错也返回GIF，避免客户端重试
      const gifBuffer = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
      )
      res.setHeader('Content-Type', 'image/gif')
      res.send(gifBuffer)
    }
  }
}
