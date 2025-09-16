import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Event } from '../../entity/event.entity';
import { IAnyObj, IRawEvent } from '@shared-types';

@Injectable()
export class DataService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @Inject('KAFKA_SERVICE')
    private kafkaClient: ClientKafka,
  ) {}

  // 分天整体页面访问数据
  async getPageData(query: IAnyObj) {
    console.log('获取页面数据:', query);
    
    const whereCondition: any = {};
    if (query.startDate && query.endDate) {
      whereCondition.logTime = {
        $gte: new Date(query.startDate),
        $lte: new Date(query.endDate),
      };
    }
    if (query.site) {
      whereCondition.site = query.site;
    }

    const events = await this.eventRepository.find({
      where: whereCondition,
      order: { logTime: 'DESC' },
      take: query.limit || 100,
    });

    return {
      message: '页面数据获取成功',
      data: events,
      total: events.length,
    };
  }

  // 分天不同页面访问数据
  async getPageDataDetail(query: IAnyObj) {
    console.log('获取页面详细数据:', query);
    
    const whereCondition: any = {};
    if (query.startDate && query.endDate) {
      whereCondition.logTime = {
        $gte: new Date(query.startDate),
        $lte: new Date(query.endDate),
      };
    }
    if (query.site) {
      whereCondition.site = query.site;
    }
    if (query.path) {
      whereCondition.path = query.path;
    }

    const events = await this.eventRepository.find({
      where: whereCondition,
      order: { logTime: 'DESC' },
      take: query.limit || 100,
    });

    return {
      message: '页面详细数据获取成功',
      data: events,
      total: events.length,
    };
  }

  // 接收原始埋点数据
  async receiveRawEvent(eventData: IRawEvent) {
    try {
      console.log('接收原始埋点数据:', eventData);

      // 1. 保存原始事件到数据库
      const event = this.eventRepository.create({
        eventName: eventData.eventName,
        ip: eventData.ip,
        ua: eventData.ua,
        site: eventData.site,
        path: eventData.path,
        params: eventData.params,
        deviceId: eventData.deviceId,
        referrer: eventData.referrer,
        utmSource: eventData.utmSource,
        utmMedium: eventData.utmMedium,
        utmCampaign: eventData.utmCampaign,
        utmTerm: eventData.utmTerm,
        utmContent: eventData.utmContent,
        logTime: eventData.logTime,
        serviceTime: new Date(),
      });

      const savedEvent = await this.eventRepository.save(event);

      // 2. 发送到Kafka进行初步处理
      await this.kafkaClient.emit('raw_event_received', {
        eventId: savedEvent.id,
        eventData: savedEvent,
        rawData: eventData.rawData,
        source: eventData.source || 'web',
        receivedAt: new Date(),
      });

      console.log('原始事件已发送到处理队列:', savedEvent.id);
      return { success: true, eventId: savedEvent.id };
    } catch (error) {
      console.error('接收原始事件失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 批量接收原始埋点数据
  async receiveBatchEvents(eventsData: IRawEvent[]) {
    try {
      console.log('批量接收埋点数据，数量:', eventsData.length);

      const results = [];
      for (const eventData of eventsData) {
        const result = await this.receiveRawEvent(eventData);
        results.push(result);
      }

      // 发送批量处理消息
      await this.kafkaClient.emit('batch_events_received', {
        events: results,
        batchSize: eventsData.length,
        receivedAt: new Date(),
      });

      console.log('批量事件已发送到处理队列');
      return { success: true, results };
    } catch (error) {
      console.error('批量接收事件失败:', error);
      return { success: false, error: error.message };
    }
  }
}
