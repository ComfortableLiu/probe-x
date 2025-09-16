import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Event } from '../../entity/event.entity';
import { ProcessedEvent } from '../../entity/processed-event.entity';
import { IAnyObj } from '@shared-types';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(ProcessedEvent)
    private processedEventRepository: Repository<ProcessedEvent>,
  ) {}

  // 获取仪表板概览数据
  async getOverview(query: IAnyObj) {
    const { startDate, endDate, site } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }

    const [totalEvents, processedEvents, uniqueUsers] = await Promise.all([
      this.eventRepository.count({ where: whereCondition }),
      this.processedEventRepository.count({ where: whereCondition }),
      this.eventRepository
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT event.deviceId)', 'count')
        .where(whereCondition)
        .getRawOne(),
    ]);

    return {
      totalEvents,
      processedEvents,
      uniqueUsers: parseInt(uniqueUsers.count) || 0,
      processingRate: totalEvents > 0 ? (processedEvents / totalEvents * 100).toFixed(2) : 0,
    };
  }

  // 获取实时数据统计
  async getRealtimeData(query: IAnyObj) {
    const { site } = query;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const whereCondition: any = {
      logTime: Between(oneHourAgo, now),
    };
    if (site) {
      whereCondition.site = site;
    }

    const events = await this.eventRepository.find({
      where: whereCondition,
      order: { logTime: 'DESC' },
      take: 100,
    });

    return {
      recentEvents: events,
      eventsCount: events.length,
      lastUpdateTime: now,
    };
  }

  // 获取页面访问趋势
  async getPageTrends(query: IAnyObj) {
    const { startDate, endDate, site, groupBy = 'day' } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }

    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'hour') {
      dateFormat = '%Y-%m-%d %H:00:00';
    } else if (groupBy === 'week') {
      dateFormat = '%Y-%u';
    } else if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    }

    const trends = await this.eventRepository
      .createQueryBuilder('event')
      .select(`DATE_FORMAT(event.logTime, '${dateFormat}')`, 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT event.deviceId)', 'uniqueUsers')
      .where(whereCondition)
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    return trends;
  }

  // 获取用户行为分析
  async getUserBehavior(query: IAnyObj) {
    const { startDate, endDate, site } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }

    const [pageViews, topPages, userJourney] = await Promise.all([
      this.eventRepository.count({ where: whereCondition }),
      this.eventRepository
        .createQueryBuilder('event')
        .select('event.path', 'path')
        .addSelect('COUNT(*)', 'count')
        .where(whereCondition)
        .groupBy('event.path')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
      this.eventRepository
        .createQueryBuilder('event')
        .select('event.deviceId', 'deviceId')
        .addSelect('COUNT(*)', 'sessionCount')
        .addSelect('AVG(TIMESTAMPDIFF(SECOND, MIN(event.logTime), MAX(event.logTime)))', 'avgSessionDuration')
        .where(whereCondition)
        .groupBy('event.deviceId')
        .getRawMany(),
    ]);

    return {
      totalPageViews: pageViews,
      topPages,
      userJourney: {
        totalSessions: userJourney.length,
        avgSessionDuration: userJourney.reduce((sum, item) => sum + parseFloat(item.avgSessionDuration || 0), 0) / userJourney.length,
      },
    };
  }

  // 获取设备统计
  async getDeviceStats(query: IAnyObj) {
    const { startDate, endDate, site } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }

    const deviceStats = await this.eventRepository
      .createQueryBuilder('event')
      .select('event.ua', 'userAgent')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT event.deviceId)', 'uniqueUsers')
      .where(whereCondition)
      .groupBy('event.ua')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    return deviceStats;
  }

  // 获取地理位置分布
  async getGeoDistribution(query: IAnyObj) {
    const { startDate, endDate, site } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }

    const geoStats = await this.eventRepository
      .createQueryBuilder('event')
      .select('event.ip', 'ip')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT event.deviceId)', 'uniqueUsers')
      .where(whereCondition)
      .groupBy('event.ip')
      .orderBy('count', 'DESC')
      .limit(50)
      .getRawMany();

    return geoStats;
  }
}
