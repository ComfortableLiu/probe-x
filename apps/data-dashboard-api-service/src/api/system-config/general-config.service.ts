import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { IGeneralConfig, IUpdateGeneralConfigReq } from '@probe-x/shared-types/src'

export const GENERAL_CONFIG_KEYS = {
  enabled: 'final_cleaning.enabled',
  dailyTime: 'final_cleaning.daily_time',
} as const

const DEFAULT_DAILY_TIME = '02:00'

@Injectable()
export class GeneralConfigService {
  constructor(
    @InjectRepository(SystemConfigEntity)
    private readonly repo: Repository<SystemConfigEntity>,
  ) {}

  async getGeneralConfig(): Promise<IGeneralConfig> {
    const rows = await this.repo.find({
      where: [{ key: GENERAL_CONFIG_KEYS.enabled }, { key: GENERAL_CONFIG_KEYS.dailyTime }],
    })
    const map = new Map(rows.map(row => [row.key, row.value]))
    const dailyTime = map.get(GENERAL_CONFIG_KEYS.dailyTime)
    return {
      enabled: map.get(GENERAL_CONFIG_KEYS.enabled) === 'true',
      dailyTime: dailyTime && /^\d{2}:\d{2}$/.test(dailyTime) ? dailyTime : DEFAULT_DAILY_TIME,
    }
  }

  async updateGeneralConfig(config: IUpdateGeneralConfigReq): Promise<void> {
    await this.repo.save([
      { key: GENERAL_CONFIG_KEYS.enabled, value: String(config.enabled), description: '最终数据清洗：是否启用每日定时清洗' },
      { key: GENERAL_CONFIG_KEYS.dailyTime, value: config.dailyTime, description: '最终数据清洗：每日清洗时间（HH:mm）' },
    ])
  }
}
