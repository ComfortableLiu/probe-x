import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Event } from '../entity/event.entity';
import { ProcessedEvent } from '../entity/processed-event.entity';
// import { IAnyObj } from '@shared-types';

@Injectable()
export class ProcessingService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(ProcessedEvent)
    private processedEventRepository: Repository<ProcessedEvent>,
    @Inject('KAFKA_SERVICE')
    private kafkaClient: ClientKafka,
  ) {}

  // 处理单个原始事件
  async processRawEvent(eventData: any) {
    try {
      console.log('开始处理原始事件:', eventData);

      // 1. 数据验证和清洗
      const cleanedData = this.cleanEventData(eventData);

      // 2. 数据增强
      const enhancedData = await this.enhanceEventData(cleanedData);

      // 3. 保存到数据库
      const processedEvent = await this.saveProcessedEvent(enhancedData);

      // 4. 发送到下一步处理
      await this.sendToNextProcessing(processedEvent);

      console.log('事件处理完成:', processedEvent.id);
      return { success: true, processedEventId: processedEvent.id };
    } catch (error) {
      console.error('事件处理失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 处理批量事件
  async processBatchEvents(batchData: any) {
    try {
      console.log('开始处理批量事件，数量:', batchData.events?.length || 0);

      const results = [];
      const events = batchData.events || [];

      for (const eventData of events) {
        const result = await this.processRawEvent(eventData);
        results.push(result);
      }

      console.log('批量事件处理完成，成功:', results.filter(r => r.success).length);
      return { success: true, results };
    } catch (error) {
      console.error('批量事件处理失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 更新处理状态
  async updateProcessingStatus(statusData: any) {
    try {
      const { eventId, status, metadata } = statusData;
      
      await this.processedEventRepository.update(
        { id: eventId },
        {
          processingStatus: status,
          processingMetadata: metadata,
          processedAt: new Date(),
        }
      );

      console.log('处理状态已更新:', eventId, status);
      return { success: true };
    } catch (error) {
      console.error('更新处理状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 数据清洗
  private cleanEventData(eventData: any): any {
    const cleaned = { ...eventData };

    // 移除空值和无效数据
    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] === null || cleaned[key] === undefined || cleaned[key] === '') {
        delete cleaned[key];
      }
    });

    // 标准化时间格式
    if (cleaned.logTime) {
      cleaned.logTime = new Date(cleaned.logTime);
    }
    if (cleaned.serviceTime) {
      cleaned.serviceTime = new Date(cleaned.serviceTime);
    }

    // 清理用户代理字符串
    if (cleaned.ua) {
      cleaned.ua = this.cleanUserAgent(cleaned.ua);
    }

    // 验证和清理IP地址
    if (cleaned.ip) {
      cleaned.ip = this.cleanIpAddress(cleaned.ip);
    }

    return cleaned;
  }

  // 数据增强
  private async enhanceEventData(eventData: any): Promise<any> {
    const enhanced = { ...eventData };

    // 添加处理时间戳
    enhanced.processedAt = new Date();

    // 解析用户代理信息
    if (enhanced.ua) {
      enhanced.userAgentInfo = this.parseUserAgent(enhanced.ua);
    }

    // 地理位置信息（如果有IP）
    if (enhanced.ip) {
      enhanced.geoInfo = await this.getGeoInfo(enhanced.ip);
    }

    // 会话信息
    enhanced.sessionInfo = this.generateSessionInfo(enhanced);

    // 页面信息
    enhanced.pageInfo = this.parsePageInfo(enhanced);

    return enhanced;
  }

  // 保存处理后的事件
  private async saveProcessedEvent(eventData: any): Promise<ProcessedEvent> {
    const processedEvent = this.processedEventRepository.create({
      originalEventId: eventData.id,
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
      serviceTime: eventData.serviceTime,
      processingStatus: 'processed',
      processedAt: eventData.processedAt,
      cleanedData: eventData,
      processingMetadata: {
        userAgentInfo: eventData.userAgentInfo,
        geoInfo: eventData.geoInfo,
        sessionInfo: eventData.sessionInfo,
        pageInfo: eventData.pageInfo,
      },
    });

    return await this.processedEventRepository.save(processedEvent);
  }

  // 发送到下一步处理
  private async sendToNextProcessing(processedEvent: ProcessedEvent) {
    await this.kafkaClient.emit('event_preliminary_processed', {
      processedEventId: processedEvent.id,
      eventData: processedEvent.cleanedData,
      metadata: processedEvent.processingMetadata,
    });
  }

  // 清理用户代理字符串
  private cleanUserAgent(ua: string): string {
    // 移除过长的用户代理字符串
    if (ua.length > 500) {
      return ua.substring(0, 500);
    }
    return ua;
  }

  // 清理IP地址
  private cleanIpAddress(ip: string): string {
    // 简单的IP地址验证
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipRegex.test(ip)) {
      return ip;
    }
    return '0.0.0.0'; // 无效IP
  }

  // 解析用户代理
  private parseUserAgent(ua: string): any {
    // 简单的用户代理解析
    const info: any = {};
    
    if (ua.includes('Chrome')) {
      info.browser = 'Chrome';
    } else if (ua.includes('Firefox')) {
      info.browser = 'Firefox';
    } else if (ua.includes('Safari')) {
      info.browser = 'Safari';
    } else if (ua.includes('Edge')) {
      info.browser = 'Edge';
    }

    if (ua.includes('Windows')) {
      info.os = 'Windows';
    } else if (ua.includes('Mac')) {
      info.os = 'macOS';
    } else if (ua.includes('Linux')) {
      info.os = 'Linux';
    } else if (ua.includes('Android')) {
      info.os = 'Android';
    } else if (ua.includes('iOS')) {
      info.os = 'iOS';
    }

    if (ua.includes('Mobile')) {
      info.device = 'Mobile';
    } else if (ua.includes('Tablet')) {
      info.device = 'Tablet';
    } else {
      info.device = 'Desktop';
    }

    return info;
  }

  // 获取地理位置信息
  private async getGeoInfo(ip: string): Promise<any> {
    // 这里可以集成第三方IP地理位置服务
    // 暂时返回模拟数据
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      timezone: 'UTC',
    };
  }

  // 生成会话信息
  private generateSessionInfo(eventData: any): any {
    return {
      sessionId: `${eventData.deviceId}_${Math.floor(Date.now() / (1000 * 60 * 30))}`, // 30分钟会话
      isNewSession: true, // 这里需要更复杂的逻辑来判断
      sessionStartTime: eventData.logTime,
    };
  }

  // 解析页面信息
  private parsePageInfo(eventData: any): any {
    const url = new URL(eventData.path, eventData.site);
    return {
      domain: url.hostname,
      path: url.pathname,
      query: url.search,
      hash: url.hash,
      fullUrl: url.href,
    };
  }
}
