import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { ConfigService } from '@nestjs/config'
import {
  BusinessException,
  ClickHouseService,
  RedisService,
  SyncCursorEntity,
  UtmItemEntity,
} from '@probe-x/shared-utils/src/lib/backend-common'
import { UserEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/User.entity'
import {
  IQueryUtmListReq,
  IQueryUtmListRes,
  IQueryUtmOptionsRes,
  IUtmItem,
  IUtmStatCursorRes,
  IUtmStatIncrementReq,
  IUtmStatSyncReq,
  IUtmStatSyncRes,
  IUpdateUtmReq,
  UtmDimension,
  UTM_DIMENSIONS,
} from '@probe-x/shared-types/src'
import {
  IUtmPersistResult,
  IUtmStatRow,
  QUEUE_NAME,
  QUEUE_TASK_NAME,
  UTM_CURSOR_NAME,
  UTM_STAT_CHUNK_SIZE,
  UTM_STAT_CRON,
  UTM_STAT_LOCK_KEY,
  UTM_STAT_LOCK_TTL,
  UTM_STAT_SCHEDULER_ID,
} from './type'

@Injectable()
export class UtmService implements OnModuleInit {
  private readonly logger = new Logger(UtmService.name)

  // 每日统计的截止日相对今天的偏移，见 resolveTargetDate
  private readonly targetOffset: number

  constructor(
    @InjectRepository(UtmItemEntity)
    private readonly utmItemRepo: Repository<UtmItemEntity>,
    @InjectRepository(SyncCursorEntity)
    private readonly syncCursorRepo: Repository<SyncCursorEntity>,
    private readonly clickHouseService: ClickHouseService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAME)
    private readonly utmQueue: Queue,
  ) {
    const configured = Number(this.configService.get<number | string>('utm.stat.targetOffset'))
    this.targetOffset = Number.isFinite(configured) ? configured : -1
  }

  /**
   * 注册单例每日统计任务（固定调度器 ID，重启不会重复注册）
   */
  async onModuleInit() {
    await this.utmQueue.upsertJobScheduler(
      UTM_STAT_SCHEDULER_ID,
      { pattern: UTM_STAT_CRON },
      {
        name: QUEUE_TASK_NAME,
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: { count: 100 },
        },
      },
    )
    this.logger.log(`UTM 每日统计任务已注册，cron ${UTM_STAT_CRON}，截止日偏移 ${this.targetOffset} 天`)
  }

  // ==================== 管理接口 ====================

  async getList(params: IQueryUtmListReq): Promise<IQueryUtmListRes> {
    const {
      dimension,
      value,
      alias,
      isDeleted,
      page = 1,
      pageSize = 20,
    } = params

    const query = this.utmItemRepo.createQueryBuilder('utm')
      .leftJoin(UserEntity, 'createUser', 'createUser.userId = utm.createUserId')
      .leftJoin(UserEntity, 'updateUser', 'updateUser.userId = utm.updateUserId')
      .where('utm.isDeleted = :isDeleted', { isDeleted: isDeleted ? 1 : 0 })

    if (dimension) {
      query.andWhere('utm.dimension = :dimension', { dimension })
    }
    if (value) {
      query.andWhere('utm.value LIKE :value', { value: `%${value}%` })
    }
    if (alias) {
      query.andWhere('utm.alias LIKE :alias', { alias: `%${alias}%` })
    }

    const total = await query.getCount()

    query.select([
      'utm.id as id',
      'utm.dimension as dimension',
      'utm.value as value',
      'utm.alias as alias',
      'utm.description as description',
      'utm.eventCount as eventCount',
      'utm.firstSeenDate as firstSeenDate',
      'utm.lastSeenDate as lastSeenDate',
      'utm.isDeleted as isDeleted',
      'utm.deletedAt as deletedAt',
      'utm.deletedUserId as deletedUserId',
      'utm.createTime as createTime',
      'utm.createUserId as createUserId',
      'createUser.username as createUsername',
      'createUser.nickname as createNickname',
      'utm.updateTime as updateTime',
      'utm.updateUserId as updateUserId',
      'updateUser.username as updateUsername',
      'updateUser.nickname as updateNickname',
    ])
      // 投放量大的排前面，其次是最近出现的
      .orderBy('utm.eventCount', 'DESC')
      .addOrderBy('utm.lastSeenDate', 'DESC')
      .addOrderBy('utm.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)

    try {
      const result = await query.getRawMany()
      return {
        total,
        page,
        pageSize,
        data: result.map(item => this.toItem(item)),
      }
    } catch (e) {
      this.logger.error('查询 UTM 条目失败', e)
      throw new BusinessException('查询失败')
    }
  }

  /**
   * UTM 取值选项
   *
   * UTM 分析的取值筛选器用：只含有效条目，一次性返回不分页。
   * 别名一并给出，前端下拉里直接展示「别名（原始取值）」
   */
  async getOptions(dimension?: UtmDimension): Promise<IQueryUtmOptionsRes> {
    const query = this.utmItemRepo.createQueryBuilder('utm')
      .select([
        'utm.id as id',
        'utm.dimension as dimension',
        'utm.value as value',
        'utm.alias as alias',
        'utm.eventCount as eventCount',
      ])
      .where('utm.isDeleted = :isDeleted', { isDeleted: 0 })
      // 投放量大的排前面，方便在下拉里先看到主力取值
      .orderBy('utm.eventCount', 'DESC')
      .addOrderBy('utm.value', 'ASC')

    if (dimension) {
      query.andWhere('utm.dimension = :dimension', { dimension })
    }

    const rows = await query.getRawMany()
    return rows.map(row => ({
      id: Number(row.id),
      dimension: row.dimension,
      value: row.value,
      alias: row.alias || undefined,
      eventCount: Number(row.eventCount ?? 0),
    }))
  }

  /**
   * 更新别名 / 描述
   * 取值本身来自埋点上报，不允许改；传空即清空
   */
  async update(id: number, { alias, description }: IUpdateUtmReq, userId: number): Promise<IUtmItem> {
    const existing = await this.utmItemRepo.findOne({ where: { id } })
    if (!existing) {
      throw new BusinessException('UTM 条目不存在')
    }

    await this.utmItemRepo.update(id, {
      alias: alias?.trim() || null,
      description: description?.trim() || null,
      updateUserId: userId,
    })

    return (await this.requireItem(id)) as IUtmItem
  }

  /**
   * 软删除：不物理删除，标记后后续统计不再计入该取值，UTM 分析也忽略它
   */
  async remove(id: number, userId: number): Promise<null> {
    const existing = await this.utmItemRepo.findOne({ where: { id } })
    if (!existing) {
      throw new BusinessException('UTM 条目不存在')
    }
    if (Number(existing.isDeleted) === 1) {
      throw new BusinessException('该 UTM 已经是删除状态')
    }

    await this.utmItemRepo.update(id, {
      isDeleted: 1,
      deletedAt: new Date(),
      deletedUserId: userId,
      updateUserId: userId,
    })
    this.logger.log(`UTM 条目 ${existing.dimension}=${existing.value} 已软删除，后续统计不再计入`)
    return null
  }

  /**
   * 恢复已删除的条目
   * 恢复只影响此后的统计；软删期间被跳过的量需要用重算补回
   */
  async restore(id: number, userId: number): Promise<IUtmItem> {
    const existing = await this.utmItemRepo.findOne({ where: { id } })
    if (!existing) {
      throw new BusinessException('UTM 条目不存在')
    }
    if (Number(existing.isDeleted) !== 1) {
      throw new BusinessException('该 UTM 不是删除状态')
    }

    await this.utmItemRepo.update(id, {
      isDeleted: 0,
      deletedAt: null,
      deletedUserId: null,
      updateUserId: userId,
    })
    this.logger.log(`UTM 条目 ${existing.dimension}=${existing.value} 已恢复统计`)
    return (await this.requireItem(id)) as IUtmItem
  }

  /**
   * 重算单条累计统计（覆盖，不是累加）
   * 用来补回软删期间被跳过的区间，或者数据口径出问题后的修复
   */
  async recalcOne(id: number): Promise<IUtmItem> {
    return this.withLock(async () => {
      const existing = await this.utmItemRepo.findOne({ where: { id } })
      if (!existing) {
        throw new BusinessException('UTM 条目不存在')
      }

      // 从数据起点重算，保证软删期间漏掉的量也能补回来
      const toDate = await this.resolveTargetDate()
      const fromDate = (await this.minEventDate()) || toDate

      const rows = fromDate > toDate
        ? []
        : await this.aggregateUtmFromClickHouse(fromDate, toDate, {
          dimension: existing.dimension!,
          value: existing.value!,
        })

      const row = rows[0]
      await this.utmItemRepo.update(id, {
        eventCount: row ? Number(row.event_count) : 0,
        firstSeenDate: row ? row.first_seen_date : null,
        lastSeenDate: row ? row.last_seen_date : null,
      })
      this.logger.log(`UTM 条目 ${existing.dimension}=${existing.value} 已重算 [${fromDate}, ${toDate}]`)

      return (await this.requireItem(id)) as IUtmItem
    })
  }

  // ==================== 统计同步 ====================

  /**
   * 全量初始化：把 ClickHouse 里已有的 UTM 全刷进统计表
   * 首次部署或口径修复时用
   */
  async fullSync(req: IUtmStatSyncReq = {}): Promise<IUtmStatSyncRes> {
    return this.withLock(async () => {
      const toDate = await this.resolveTargetDate(req.dateTo)
      const fromDate = req.dateFrom
        ? this.normalizeDate(req.dateFrom, '起始日期')
        : (await this.minEventDate()) || toDate

      this.logger.log(`UTM 全量统计 [${fromDate}, ${toDate}]`)
      return this.syncRange(fromDate, toDate)
    })
  }

  /**
   * 增量统计：只统计游标之后到目标日的新增量
   * 同一天不会被二次累加（游标只前进不回退）
   */
  async incrementalSync(req: IUtmStatIncrementReq = {}): Promise<IUtmStatSyncRes> {
    return this.withLock(async () => {
      const cursorDate = await this.getCursorDate()
      if (!cursorDate) {
        throw new BusinessException('尚未初始化 UTM 统计，请先执行全量同步')
      }

      const toDate = await this.resolveTargetDate(req.dateTo)
      const fromDate = this.addDays(cursorDate, 1)

      this.logger.log(`UTM 增量统计 [${fromDate}, ${toDate}]`)
      return this.syncRange(fromDate, toDate)
    })
  }

  /**
   * 每日任务入口：没有游标时自动先做全量初始化
   */
  async runDaily(): Promise<IUtmStatSyncRes> {
    return this.withLock(async () => {
      const toDate = await this.resolveTargetDate()
      const cursorDate = await this.getCursorDate()
      const fromDate = cursorDate ? this.addDays(cursorDate, 1) : ((await this.minEventDate()) || toDate)

      this.logger.log(`UTM 每日统计 [${fromDate}, ${toDate}]`)
      return this.syncRange(fromDate, toDate)
    })
  }

  async getCursor(): Promise<IUtmStatCursorRes> {
    const cursor = await this.syncCursorRepo.findOne({ where: { name: UTM_CURSOR_NAME } })
    return {
      cursorDate: this.toDateOnly(cursor?.cursorDate),
      updateTime: this.toDateTime(cursor?.updateTime),
      targetOffset: this.targetOffset,
    }
  }

  /**
   * 已软删除的取值清单
   * 未来的 UTM 分析用它拼 NOT IN 过滤，忽略掉删除的 UTM
   */
  async getIgnoredValues(): Promise<Record<UtmDimension, string[]>> {
    const result = {} as Record<UtmDimension, string[]>
    for (const dimension of UTM_DIMENSIONS) {
      result[dimension] = []
    }

    const rows = await this.utmItemRepo.find({
      where: { isDeleted: 1 },
      select: ['dimension', 'value'],
    })
    for (const row of rows) {
      result[row.dimension!]?.push(row.value!)
    }
    return result
  }

  // ==================== 内部实现 ====================

  /**
   * 统计并落库 [fromDate, toDate]，成功后把游标推到 toDate
   */
  private async syncRange(fromDate: string, toDate: string): Promise<IUtmStatSyncRes> {
    const cursorDate = await this.getCursorDate()

    // 起点晚于截止日（典型情形：目标日默认取昨天，而目前只有当天的数据）
    // 这部分量留给下一个批次结算。这里不推游标 —— 本轮确实什么都没统计，
    // 把游标推到 toDate 会把没统计的日期标成已统计
    if (fromDate > toDate) {
      this.logger.log(`UTM 统计区间为空 [${fromDate}, ${toDate}]，本轮跳过`)
      return {
        fromDate,
        toDate,
        scanned: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        cursorDate,
      }
    }

    const rows = await this.aggregateUtmFromClickHouse(fromDate, toDate)
    const persisted = await this.persistStats(rows)
    const nextCursor = await this.setCursor(toDate)

    this.logger.log(
      `UTM 统计完成 [${fromDate}, ${toDate}]：扫描 ${persisted.scanned}，新增 ${persisted.inserted}，` +
      `累加 ${persisted.updated}，软删跳过 ${persisted.skipped}，游标 -> ${nextCursor}`,
    )

    return {
      fromDate,
      toDate,
      ...persisted,
      cursorDate: nextCursor,
    }
  }

  /**
   * 从 ClickHouse 按天聚合 UTM 各维度取值
   * 用 arrayJoin 把 5 个 UTM 列一次炸成 (维度, 取值) 行，只扫一遍 event_log
   */
  private async aggregateUtmFromClickHouse(
    dateFrom: string,
    dateTo: string,
    filter?: { dimension: UtmDimension; value: string },
  ): Promise<IUtmStatRow[]> {
    const params: Record<string, string> = { dateFrom, dateTo }
    let filterClause = ''
    if (filter) {
      filterClause = '  AND dim.1 = {dimension:String}\n  AND dim.2 = {value:String}\n'
      params.dimension = filter.dimension
      params.value = filter.value
    }

    const sql = `
      SELECT
        dim.1 AS dimension,
        dim.2 AS value,
        count(*) AS event_count,
        toString(min(toDate(\`$service_time\`))) AS first_seen_date,
        toString(max(toDate(\`$service_time\`))) AS last_seen_date
      FROM event_log
      ARRAY JOIN [
        tuple('source',   \`$utm_source\`),
        tuple('medium',   \`$utm_medium\`),
        tuple('campaign', \`$utm_campaign\`),
        tuple('term',     \`$utm_term\`),
        tuple('content',  \`$utm_content\`)
      ] AS dim
      WHERE toDate(\`$service_time\`) BETWEEN toDate({dateFrom:String}) AND toDate({dateTo:String})
        AND dim.2 != ''
        ${filterClause}
      GROUP BY dim.1, dim.2
      ORDER BY dim.1, dim.2
    `

    return await this.clickHouseService.query<IUtmStatRow>(sql, params)
  }

  /**
   * 落库规则：
   * 1. 已软删除的取值直接跳过 —— 既不插入也不累加，计数从此冻结
   * 2. 其余按 (维度, 取值) upsert：事件数累加，首末次出现日期取全局极值
   *    （增量窗口里的 min/max 只是窗口内极值，必须与既有值合并，否则会覆盖掉更早的首见日期）
   */
  private async persistStats(rows: IUtmStatRow[]): Promise<IUtmPersistResult> {
    if (!rows.length) {
      return { scanned: 0, inserted: 0, updated: 0, skipped: 0 }
    }

    const deletedKeys = new Set(
      (await this.utmItemRepo.find({ where: { isDeleted: 1 }, select: ['dimension', 'value'] }))
        .map(item => this.buildKey(item.dimension!, item.value!)),
    )

    const effective = rows.filter(row => !deletedKeys.has(this.buildKey(row.dimension, row.value)))
    const skipped = rows.length - effective.length

    let inserted = 0
    let updated = 0
    for (const chunk of this.chunk(effective, UTM_STAT_CHUNK_SIZE)) {
      const existingKeys = await this.findExistingKeys(chunk)
      for (const row of chunk) {
        if (existingKeys.has(this.buildKey(row.dimension, row.value))) {
          updated++
        } else {
          inserted++
        }
      }

      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ')
      const params = chunk.flatMap(row => [
        row.dimension,
        row.value,
        Number(row.event_count),
        row.first_seen_date,
        row.last_seen_date,
      ])

      // 取值来自埋点上报，必须走占位符绑定，不能拼进 SQL
      // LEAST/GREATEST 任一参数为 NULL 会整体返回 NULL，event_count + NULL 也是 NULL，
      // 都用 IFNULL 兜住，避免极端情况下把既有计数抹掉
      await this.utmItemRepo.query(
        `INSERT INTO utm_item (dimension, value, event_count, first_seen_date, last_seen_date)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE
           event_count = event_count + IFNULL(VALUES(event_count), 0),
           first_seen_date = LEAST(
             IFNULL(first_seen_date, '9999-12-31'),
             IFNULL(VALUES(first_seen_date), '9999-12-31')
           ),
           last_seen_date = GREATEST(
             IFNULL(last_seen_date, '1970-01-01'),
             IFNULL(VALUES(last_seen_date), '1970-01-01')
           )`,
        params,
      )
    }

    return { scanned: rows.length, inserted, updated, skipped }
  }

  private async findExistingKeys(rows: IUtmStatRow[]): Promise<Set<string>> {
    if (!rows.length) return new Set()

    const keys = rows.map(row => row.dimension)
    const found = await this.utmItemRepo.createQueryBuilder('utm')
      .select(['utm.dimension as dimension', 'utm.value as value'])
      .where('utm.dimension IN (:...keys)', { keys: [...new Set(keys)] })
      .getRawMany()

    const wanted = new Set(rows.map(row => this.buildKey(row.dimension, row.value)))
    return new Set(found.map(row => this.buildKey(row.dimension, row.value)).filter(key => wanted.has(key)))
  }

  private async getCursorDate(): Promise<string | null> {
    const cursor = await this.syncCursorRepo.findOne({ where: { name: UTM_CURSOR_NAME } })
    return this.toDateOnly(cursor?.cursorDate)
  }

  /**
   * 游标只前进不回退
   */
  private async setCursor(dateTo: string): Promise<string> {
    const existing = await this.syncCursorRepo.findOne({ where: { name: UTM_CURSOR_NAME } })
    const current = this.toDateOnly(existing?.cursorDate)

    // 正常统计的截止日一定不早于当前游标；若手动传了更早的 dateTo 也不回退
    if (current && current >= dateTo) {
      return current
    }

    if (existing) {
      await this.syncCursorRepo.update({ name: UTM_CURSOR_NAME }, { cursorDate: dateTo })
    } else {
      await this.syncCursorRepo.insert({ name: UTM_CURSOR_NAME, cursorDate: dateTo })
    }
    return dateTo
  }

  /**
   * 每日统计的截止日
   *
   * 默认取「昨天」而不是「今天」：当天数据还在流动，如果统计到今天并把游标推到今天，
   * 当天剩余时段的量就永久漏掉了。改成统计当天把 UTM_STAT_TARGET_OFFSET 置 0 即可。
   * 显式传 dateTo 时（手动补跑）直接用传入值。
   */
  private async resolveTargetDate(dateTo?: string): Promise<string> {
    if (dateTo) {
      return this.normalizeDate(dateTo, '截止日期')
    }
    // 让 ClickHouse 算目标日，保证与聚合 SQL 同一时区
    const rows = await this.clickHouseService.query<{ d: string }>(
      'SELECT toString(today() + {offset:Int16}) AS d',
      { offset: this.targetOffset },
    )
    return rows?.[0]?.d
  }

  /**
   * ClickHouse 里最早的数据日期，全量同步的起点
   */
  private async minEventDate(): Promise<string | null> {
    const rows = await this.clickHouseService.query<{ cnt: string | number; d: string | null }>(
      'SELECT count(*) AS cnt, toString(min(toDate(`$service_time`))) AS d FROM event_log',
    )
    const row = rows?.[0]
    if (!row || Number(row.cnt) === 0 || !row.d) return null
    return row.d
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const acquired = await this.redisService.setNx(UTM_STAT_LOCK_KEY, '1', UTM_STAT_LOCK_TTL)
    if (!acquired) {
      throw new BusinessException('UTM 统计正在执行中，请稍后再试')
    }
    try {
      return await fn()
    } finally {
      await this.redisService.del(UTM_STAT_LOCK_KEY)
    }
  }

  private async requireItem(id: number): Promise<IUtmItem> {
    const query = this.utmItemRepo.createQueryBuilder('utm')
      .leftJoin(UserEntity, 'createUser', 'createUser.userId = utm.createUserId')
      .leftJoin(UserEntity, 'updateUser', 'updateUser.userId = utm.updateUserId')
      .where('utm.id = :id', { id })
      .select([
        'utm.id as id',
        'utm.dimension as dimension',
        'utm.value as value',
        'utm.alias as alias',
        'utm.description as description',
        'utm.eventCount as eventCount',
        'utm.firstSeenDate as firstSeenDate',
        'utm.lastSeenDate as lastSeenDate',
        'utm.isDeleted as isDeleted',
        'utm.deletedAt as deletedAt',
        'utm.deletedUserId as deletedUserId',
        'utm.createTime as createTime',
        'utm.createUserId as createUserId',
        'createUser.username as createUsername',
        'createUser.nickname as createNickname',
        'utm.updateTime as updateTime',
        'utm.updateUserId as updateUserId',
        'updateUser.username as updateUsername',
        'updateUser.nickname as updateNickname',
      ])

    const raw = await query.getRawOne()
    if (!raw) {
      throw new BusinessException('UTM 条目不存在')
    }
    return this.toItem(raw)
  }

  private toItem(raw: Record<string, any>): IUtmItem {
    return {
      id: Number(raw.id),
      dimension: raw.dimension,
      value: raw.value,
      alias: raw.alias || undefined,
      description: raw.description || undefined,
      eventCount: Number(raw.eventCount ?? 0),
      firstSeenDate: this.toDateOnly(raw.firstSeenDate) || undefined,
      lastSeenDate: this.toDateOnly(raw.lastSeenDate) || undefined,
      isDeleted: Number(raw.isDeleted) === 1,
      deletedAt: this.toDateTime(raw.deletedAt) || undefined,
      deletedUserId: raw.deletedUserId === null || raw.deletedUserId === undefined
        ? undefined
        : Number(raw.deletedUserId),
      createTime: this.toDateTime(raw.createTime) || undefined,
      createUserId: this.toNumberOrUndefined(raw.createUserId),
      createUsername: raw.createUsername || undefined,
      createNickname: raw.createNickname || undefined,
      updateTime: this.toDateTime(raw.updateTime) || undefined,
      updateUserId: this.toNumberOrUndefined(raw.updateUserId),
      updateUsername: raw.updateUsername || undefined,
      updateNickname: raw.updateNickname || undefined,
    }
  }

  /**
   * DATE 列 -> YYYY-MM-DD
   * 驱动可能给字符串也可能给本地零点的 Date，统一取本地日历日
   */
  private toDateOnly(value: Date | string | null | undefined): string | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value.slice(0, 10)
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private toDateTime(value: Date | string | null | undefined): string | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value
    return value.toISOString()
  }

  private toNumberOrUndefined(value: any): number | undefined {
    return value === null || value === undefined ? undefined : Number(value)
  }

  /**
   * 日历日加减天数，纯字符串语义，不受时区影响
   */
  private addDays(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
  }

  private normalizeDate(value: string, field: string): string {
    const trimmed = value.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BusinessException(`${field}格式应为 YYYY-MM-DD`)
    }
    return trimmed
  }

  private buildKey(dimension: UtmDimension, value: string): string {
    return `${dimension} ${value}`
  }

  private chunk<T>(list: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < list.length; i += size) {
      result.push(list.slice(i, i + size))
    }
    return result
  }
}
