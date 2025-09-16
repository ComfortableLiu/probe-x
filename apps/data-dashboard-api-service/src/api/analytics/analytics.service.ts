import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Event } from '../../entity/event.entity';
import { ProcessedEvent } from '../../entity/processed-event.entity';
import { IAnyObj } from '@shared-types';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(ProcessedEvent)
    private processedEventRepository: Repository<ProcessedEvent>,
  ) {}

  // 获取漏斗分析
  async getFunnelAnalysis(query: IAnyObj) {
    const { startDate, endDate, site, steps } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }

    const funnelSteps = steps ? JSON.parse(steps) : [
      { name: '首页访问', path: '/' },
      { name: '产品页', path: '/product' },
      { name: '购买页', path: '/checkout' },
    ];

    const funnelData = [];
    for (let i = 0; i < funnelSteps.length; i++) {
      const step = funnelSteps[i];
      const stepCondition = { ...whereCondition, path: step.path };
      
      const count = await this.eventRepository.count({ where: stepCondition });
      const uniqueUsers = await this.eventRepository
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT event.deviceId)', 'count')
        .where(stepCondition)
        .getRawOne();

      funnelData.push({
        step: step.name,
        count,
        uniqueUsers: parseInt(uniqueUsers.count) || 0,
        conversionRate: i === 0 ? 100 : funnelData[0].count > 0 ? (count / funnelData[0].count * 100).toFixed(2) : 0,
      });
    }

    return funnelData;
  }

  // 获取留存分析
  async getRetentionAnalysis(query: IAnyObj) {
    const { startDate, endDate, site, cohortType = 'day' } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }

    // 获取首次访问用户
    const firstTimeUsers = await this.eventRepository
      .createQueryBuilder('event')
      .select('event.deviceId', 'deviceId')
      .addSelect('MIN(event.logTime)', 'firstVisit')
      .where(whereCondition)
      .groupBy('event.deviceId')
      .getRawMany();

    // 计算留存率
    const retentionData = [];
    const cohortGroups = new Map();

    firstTimeUsers.forEach(user => {
      const cohortDate = new Date(user.firstVisit);
      const cohortKey = cohortDate.toISOString().split('T')[0];
      
      if (!cohortGroups.has(cohortKey)) {
        cohortGroups.set(cohortKey, []);
      }
      cohortGroups.get(cohortKey).push(user.deviceId);
    });

    for (const [cohortDate, users] of Array.from(cohortGroups.entries())) {
      const cohortSize = users.length;
      const retentionRates = [];

      for (let day = 1; day <= 30; day++) {
        const targetDate = new Date(cohortDate);
        targetDate.setDate(targetDate.getDate() + day);

        const retainedUsers = await this.eventRepository
          .createQueryBuilder('event')
          .select('COUNT(DISTINCT event.deviceId)', 'count')
          .where('event.deviceId IN (:...users)', { users })
          .andWhere('DATE(event.logTime) = :targetDate', { targetDate: targetDate.toISOString().split('T')[0] })
          .getRawOne();

        const retentionRate = cohortSize > 0 ? (parseInt(retainedUsers.count) / cohortSize * 100).toFixed(2) : '0';
        retentionRates.push({
          day,
          rate: parseFloat(retentionRate),
          users: parseInt(retainedUsers.count) || 0,
        });
      }

      retentionData.push({
        cohortDate,
        cohortSize,
        retentionRates,
      });
    }

    return retentionData;
  }

  // 获取事件分析
  async getEventAnalysis(query: IAnyObj) {
    const { startDate, endDate, site, eventName } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }
    if (eventName) {
      whereCondition.eventName = eventName;
    }

    const [eventStats, eventTrends, topEvents] = await Promise.all([
      this.eventRepository
        .createQueryBuilder('event')
        .select('event.eventName', 'eventName')
        .addSelect('COUNT(*)', 'totalCount')
        .addSelect('COUNT(DISTINCT event.deviceId)', 'uniqueUsers')
        .addSelect('AVG(TIMESTAMPDIFF(SECOND, event.logTime, event.serviceTime))', 'avgProcessingTime')
        .where(whereCondition)
        .groupBy('event.eventName')
        .getRawMany(),
      this.eventRepository
        .createQueryBuilder('event')
        .select('DATE(event.logTime)', 'date')
        .addSelect('event.eventName', 'eventName')
        .addSelect('COUNT(*)', 'count')
        .where(whereCondition)
        .groupBy('date, event.eventName')
        .orderBy('date', 'ASC')
        .getRawMany(),
      this.eventRepository
        .createQueryBuilder('event')
        .select('event.eventName', 'eventName')
        .addSelect('COUNT(*)', 'count')
        .where(whereCondition)
        .groupBy('event.eventName')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
    ]);

    return {
      eventStats,
      eventTrends,
      topEvents,
    };
  }

  // 获取自定义报告
  async getCustomReports(query: IAnyObj) {
    // 这里应该从数据库或缓存中获取用户创建的自定义报告
    // 暂时返回示例数据
    return {
      reports: [
        {
          id: 1,
          name: '用户行为分析报告',
          description: '分析用户在网站上的行为模式',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: '转化漏斗报告',
          description: '分析用户从访问到转化的完整路径',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
  }

  // 创建自定义报告
  async createCustomReport(reportData: IAnyObj) {
    // 这里应该将报告配置保存到数据库
    return {
      id: Date.now(),
      ...reportData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // 导出数据
  async exportData(query: IAnyObj) {
    const { startDate, endDate, site, format = 'json' } = query;
    
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.logTime = Between(new Date(startDate), new Date(endDate));
    }
    if (site) {
      whereCondition.site = site;
    }

    const events = await this.eventRepository.find({
      where: whereCondition,
      order: { logTime: 'DESC' },
      take: 10000, // 限制导出数量
    });

    return {
      data: events,
      total: events.length,
      format,
      exportedAt: new Date(),
    };
  }
}
