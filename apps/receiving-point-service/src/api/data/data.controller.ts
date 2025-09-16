import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { DataService } from './data.service';
import { IAnyObj, IRawEvent } from "@shared-types";

@Controller('/data')
export class DataController {
  constructor(private readonly dataService: DataService) {}

  // 分天整体页面访问数据
  @Get('/page')
  async getPageData(@Query() query: IAnyObj) {
    return this.dataService.getPageData(query);
  }

  // 分天不同页面访问数据
  @Get('/page-detail')
  async getPageDataDetail(@Query() query: IAnyObj) {
    return this.dataService.getPageDataDetail(query);
  }

  // 接收单个埋点事件
  @Post('/track')
  async trackEvent(@Body() eventData: IRawEvent) {
    return this.dataService.receiveRawEvent(eventData);
  }

  // 接收批量埋点事件
  @Post('/track/batch')
  async trackBatchEvents(@Body() body: { events: IRawEvent[] }) {
    return this.dataService.receiveBatchEvents(body.events);
  }

  // 接收Beacon数据（GET方式，兼容现有埋点）
  @Get('/beacon')
  async receiveBeacon(@Query() query: IAnyObj) {
    console.log('Beacon data received:', query);
    
    // 将查询参数转换为事件数据
    const eventData: IRawEvent = {
      eventName: query.event || 'page_view',
      ip: query.ip,
      ua: query.ua,
      site: query.site || 'unknown',
      path: query.path || '/',
      params: query.params,
      deviceId: query.deviceId || query.did,
      referrer: query.referrer,
      utmSource: query.utm_source,
      utmMedium: query.utm_medium,
      utmCampaign: query.utm_campaign,
      utmTerm: query.utm_term,
      utmContent: query.utm_content,
      logTime: new Date(),
      rawData: query,
      source: 'beacon',
    };

    return this.dataService.receiveRawEvent(eventData);
  }
}
