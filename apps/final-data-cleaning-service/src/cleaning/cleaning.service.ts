import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { ProcessedEvent } from '../entity/processed-event.entity';
import { CleanedEvent } from '../entity/cleaned-event.entity';
import { IAnyObj } from '@shared-types';

@Injectable()
export class CleaningService {
  constructor(
    @InjectRepository(ProcessedEvent)
    private processedEventRepository: Repository<ProcessedEvent>,
    @InjectRepository(CleanedEvent)
    private cleanedEventRepository: Repository<CleanedEvent>,
    @Inject('KAFKA_SERVICE')
    private kafkaClient: ClientKafka,
  ) {}

  // 执行最终数据清洗
  async performFinalCleaning(data: IAnyObj) {
    try {
      console.log('开始执行最终数据清洗:', data);

      const { processedEventId, eventData, metadata } = data;

      // 1. 获取处理过的事件数据
      const processedEvent = await this.processedEventRepository.findOne({
        where: { id: processedEventId },
      });

      if (!processedEvent) {
        throw new Error(`未找到处理过的事件: ${processedEventId}`);
      }

      // 2. 执行深度数据清洗
      const cleanedData = await this.performDeepCleaning(processedEvent);

      // 3. 数据质量评估
      const qualityScore = await this.assessDataQuality(cleanedData);

      // 4. 数据验证
      const validationResult = await this.validateData(cleanedData);

      // 5. 保存清洗后的数据
      const cleanedEvent = await this.saveCleanedEvent(
        processedEvent,
        cleanedData,
        qualityScore,
        validationResult,
      );

      // 6. 发送到数据存储
      await this.sendToDataStorage(cleanedEvent);

      console.log('最终数据清洗完成:', cleanedEvent.id);
      return { success: true, cleanedEventId: cleanedEvent.id };
    } catch (error) {
      console.error('最终数据清洗失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 执行批量清洗
  async performBatchCleaning(batchData: IAnyObj) {
    try {
      console.log('开始执行批量清洗，数量:', batchData.processedEventIds?.length || 0);

      const results = [];
      const processedEventIds = batchData.processedEventIds || [];

      for (const processedEventId of processedEventIds) {
        const result = await this.performFinalCleaning({
          processedEventId,
          eventData: null,
          metadata: null,
        });
        results.push(result);
      }

      console.log('批量清洗完成，成功:', results.filter(r => r.success).length);
      return { success: true, results };
    } catch (error) {
      console.error('批量清洗失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 执行数据质量检查
  async performDataQualityCheck(data: IAnyObj) {
    try {
      const { cleanedEventId } = data;
      
      const cleanedEvent = await this.cleanedEventRepository.findOne({
        where: { id: cleanedEventId },
      });

      if (!cleanedEvent) {
        throw new Error(`未找到清洗后的事件: ${cleanedEventId}`);
      }

      const qualityReport = await this.generateQualityReport(cleanedEvent);
      
      return { success: true, qualityReport };
    } catch (error) {
      console.error('数据质量检查失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 更新清洗状态
  async updateCleaningStatus(statusData: IAnyObj) {
    try {
      const { cleanedEventId, status, metadata } = statusData;
      
      await this.cleanedEventRepository.update(
        { id: cleanedEventId },
        {
          cleaningStatus: status,
          cleaningMetadata: metadata,
          cleanedAt: new Date(),
        }
      );

      console.log('清洗状态已更新:', cleanedEventId, status);
      return { success: true };
    } catch (error) {
      console.error('更新清洗状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 执行深度数据清洗
  private async performDeepCleaning(processedEvent: ProcessedEvent): Promise<IAnyObj> {
    const cleaned = { ...processedEvent.cleanedData };

    // 1. 数据标准化
    cleaned.standardizedData = this.standardizeData(cleaned);

    // 2. 异常值检测和处理
    cleaned.anomalyDetection = await this.detectAnomalies(cleaned);

    // 3. 数据去重
    cleaned.deduplication = await this.performDeduplication(cleaned);

    // 4. 数据补全
    cleaned.dataCompletion = await this.completeMissingData(cleaned);

    // 5. 数据转换
    cleaned.dataTransformation = this.transformData(cleaned);

    // 6. 数据聚合
    cleaned.dataAggregation = await this.aggregateData(cleaned);

    return cleaned;
  }

  // 数据标准化
  private standardizeData(data: IAnyObj): IAnyObj {
    const standardized: IAnyObj = {};

    // 标准化时间格式
    if (data.logTime) {
      standardized.logTime = new Date(data.logTime).toISOString();
    }
    if (data.serviceTime) {
      standardized.serviceTime = new Date(data.serviceTime).toISOString();
    }

    // 标准化URL格式
    if (data.path) {
      standardized.path = this.standardizeUrl(data.path);
    }

    // 标准化用户代理
    if (data.ua) {
      standardized.ua = this.standardizeUserAgent(data.ua);
    }

    // 标准化设备ID
    if (data.deviceId) {
      standardized.deviceId = this.standardizeDeviceId(data.deviceId);
    }

    return standardized;
  }

  // 异常值检测
  private async detectAnomalies(data: IAnyObj): Promise<IAnyObj> {
    const anomalies: IAnyObj = {};

    // 检测异常时间戳
    if (data.logTime) {
      const logTime = new Date(data.logTime);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - logTime.getTime());
      
      if (timeDiff > 24 * 60 * 60 * 1000) { // 超过24小时
        anomalies.timeAnomaly = {
          type: 'future_or_old_timestamp',
          value: data.logTime,
          severity: 'high',
        };
      }
    }

    // 检测异常IP地址
    if (data.ip) {
      if (this.isPrivateIP(data.ip) || this.isReservedIP(data.ip)) {
        anomalies.ipAnomaly = {
          type: 'private_or_reserved_ip',
          value: data.ip,
          severity: 'medium',
        };
      }
    }

    // 检测异常用户代理
    if (data.ua) {
      if (data.ua.length < 10 || data.ua.length > 1000) {
        anomalies.uaAnomaly = {
          type: 'suspicious_user_agent',
          value: data.ua,
          severity: 'medium',
        };
      }
    }

    return anomalies;
  }

  // 数据去重
  private async performDeduplication(data: IAnyObj): Promise<IAnyObj> {
    // 基于设备ID、时间戳、事件名称进行去重
    const deduplicationKey = `${data.deviceId}_${data.eventName}_${data.logTime}`;
    
    // 检查是否已存在相同的数据
    const existingEvent = await this.cleanedEventRepository.findOne({
      where: {
        deviceId: data.deviceId,
        eventName: data.eventName,
        logTime: data.logTime,
      },
    });

    return {
      isDuplicate: !!existingEvent,
      deduplicationKey,
      existingEventId: existingEvent?.id,
    };
  }

  // 数据补全
  private async completeMissingData(data: IAnyObj): Promise<IAnyObj> {
    const completed = { ...data };

    // 补全缺失的地理位置信息
    if (!completed.geoInfo && completed.ip) {
      completed.geoInfo = await this.getGeoInfo(completed.ip);
    }

    // 补全缺失的会话信息
    if (!completed.sessionInfo) {
      completed.sessionInfo = this.generateSessionInfo(completed);
    }

    // 补全缺失的页面信息
    if (!completed.pageInfo) {
      completed.pageInfo = this.parsePageInfo(completed);
    }

    return completed;
  }

  // 数据转换
  private transformData(data: IAnyObj): IAnyObj {
    const transformed: IAnyObj = {};

    // 转换事件类型
    transformed.eventType = this.categorizeEvent(data.eventName);

    // 转换设备类型
    transformed.deviceType = this.categorizeDevice(data.ua);

    // 转换流量来源
    transformed.trafficSource = this.categorizeTrafficSource(data);

    return transformed;
  }

  // 数据聚合
  private async aggregateData(data: IAnyObj): Promise<IAnyObj> {
    const aggregated: IAnyObj = {};

    // 按小时聚合
    const hour = new Date(data.logTime).getHours();
    aggregated.hourlyStats = {
      hour,
      period: this.getTimePeriod(hour),
    };

    // 按天聚合
    const day = new Date(data.logTime).getDay();
    aggregated.dailyStats = {
      day,
      dayName: this.getDayName(day),
    };

    return aggregated;
  }

  // 评估数据质量
  private async assessDataQuality(data: IAnyObj): Promise<number> {
    let score = 100;

    // 检查必填字段
    const requiredFields = ['eventName', 'deviceId', 'logTime', 'site'];
    for (const field of requiredFields) {
      if (!data[field]) {
        score -= 20;
      }
    }

    // 检查数据完整性
    if (!data.ip) score -= 5;
    if (!data.ua) score -= 5;
    if (!data.path) score -= 5;

    // 检查数据有效性
    if (data.anomalyDetection) {
      const anomalies = Object.keys(data.anomalyDetection);
      score -= anomalies.length * 10;
    }

    // 检查数据一致性
    if (data.deduplication?.isDuplicate) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  // 数据验证
  private async validateData(data: IAnyObj): Promise<IAnyObj> {
    const validation: IAnyObj = {
      isValid: true,
      errors: [],
    };

    // 验证事件名称
    if (!data.eventName || typeof data.eventName !== 'string') {
      validation.errors.push('事件名称无效');
      validation.isValid = false;
    }

    // 验证设备ID
    if (!data.deviceId || typeof data.deviceId !== 'string') {
      validation.errors.push('设备ID无效');
      validation.isValid = false;
    }

    // 验证时间戳
    if (!data.logTime || isNaN(new Date(data.logTime).getTime())) {
      validation.errors.push('日志时间无效');
      validation.isValid = false;
    }

    // 验证网站
    if (!data.site || typeof data.site !== 'string') {
      validation.errors.push('网站信息无效');
      validation.isValid = false;
    }

    return validation;
  }

  // 保存清洗后的数据
  private async saveCleanedEvent(
    processedEvent: ProcessedEvent,
    cleanedData: IAnyObj,
    qualityScore: number,
    validationResult: IAnyObj,
  ): Promise<CleanedEvent> {
    const cleanedEvent = this.cleanedEventRepository.create({
      processedEventId: processedEvent.id,
      originalEventId: processedEvent.originalEventId,
      eventName: processedEvent.eventName,
      ip: processedEvent.ip,
      ua: processedEvent.ua,
      site: processedEvent.site,
      path: processedEvent.path,
      params: processedEvent.params,
      deviceId: processedEvent.deviceId,
      referrer: processedEvent.referrer,
      utmSource: processedEvent.utmSource,
      utmMedium: processedEvent.utmMedium,
      utmCampaign: processedEvent.utmCampaign,
      utmTerm: processedEvent.utmTerm,
      utmContent: processedEvent.utmContent,
      logTime: processedEvent.logTime,
      serviceTime: processedEvent.serviceTime,
      cleaningStatus: 'completed',
      cleanedAt: new Date(),
      finalData: cleanedData,
      cleaningMetadata: {
        qualityScore,
        validationResult,
        cleaningTimestamp: new Date(),
      },
      qualityScore,
      isValid: validationResult.isValid,
      validationErrors: validationResult.errors,
    });

    return await this.cleanedEventRepository.save(cleanedEvent);
  }

  // 发送到数据存储
  private async sendToDataStorage(cleanedEvent: CleanedEvent) {
    await this.kafkaClient.emit('event_final_cleaned', {
      cleanedEventId: cleanedEvent.id,
      eventData: cleanedEvent.finalData,
      metadata: cleanedEvent.cleaningMetadata,
    });
  }

  // 生成质量报告
  private async generateQualityReport(cleanedEvent: CleanedEvent): Promise<IAnyObj> {
    return {
      eventId: cleanedEvent.id,
      qualityScore: cleanedEvent.qualityScore,
      isValid: cleanedEvent.isValid,
      validationErrors: cleanedEvent.validationErrors,
      cleaningMetadata: cleanedEvent.cleaningMetadata,
      reportGeneratedAt: new Date(),
    };
  }

  // 辅助方法
  private standardizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  }

  private standardizeUserAgent(ua: string): string {
    return ua.substring(0, 500); // 限制长度
  }

  private standardizeDeviceId(deviceId: string): string {
    return deviceId.toLowerCase().trim();
  }

  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
    ];
    return privateRanges.some(range => range.test(ip));
  }

  private isReservedIP(ip: string): boolean {
    const reservedRanges = [
      /^127\./,
      /^169\.254\./,
      /^0\./,
    ];
    return reservedRanges.some(range => range.test(ip));
  }

  private getGeoInfo(ip: string): IAnyObj {
    // 这里可以集成第三方IP地理位置服务
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      timezone: 'UTC',
    };
  }

  private generateSessionInfo(data: IAnyObj): IAnyObj {
    return {
      sessionId: `${data.deviceId}_${Math.floor(Date.now() / (1000 * 60 * 30))}`,
      isNewSession: true,
      sessionStartTime: data.logTime,
    };
  }

  private parsePageInfo(data: IAnyObj): IAnyObj {
    try {
      const url = new URL(data.path, data.site);
      return {
        domain: url.hostname,
        path: url.pathname,
        query: url.search,
        hash: url.hash,
        fullUrl: url.href,
      };
    } catch {
      return {
        domain: data.site,
        path: data.path,
        query: '',
        hash: '',
        fullUrl: data.path,
      };
    }
  }

  private categorizeEvent(eventName: string): string {
    if (eventName.includes('page')) return 'page_view';
    if (eventName.includes('click')) return 'click';
    if (eventName.includes('scroll')) return 'scroll';
    if (eventName.includes('form')) return 'form_interaction';
    return 'other';
  }

  private categorizeDevice(ua: string): string {
    if (ua.includes('Mobile')) return 'mobile';
    if (ua.includes('Tablet')) return 'tablet';
    return 'desktop';
  }

  private categorizeTrafficSource(data: IAnyObj): string {
    if (data.utmSource) return 'utm';
    if (data.referrer) return 'referral';
    return 'direct';
  }

  private getTimePeriod(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }
}
