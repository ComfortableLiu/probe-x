import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DataSourceEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/DataSource.entity'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common/entity/response.entity'
import {
  ICreateDataSourceReq,
  ICreateDataSourceRes,
  IDataSourceListItem,
  IQueryDataSourceListReq,
  IQueryDataSourceListRes,
  ITestDataSourceConnectionRes,
  IUpdateDataSourceReq,
  IUpdateDataSourceRes,
} from '@probe-x/shared-types/src'

@Injectable()
export class DataSourceService {
  constructor(
    @InjectRepository(DataSourceEntity)
    private dataSourceRepo: Repository<DataSourceEntity>,
  ) {}

  async getList(params: IQueryDataSourceListReq): Promise<IQueryDataSourceListRes> {
    const { datasourceName, datasourceType, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.dataSourceRepo.createQueryBuilder('ds')

    if (datasourceName) {
      qb.andWhere('ds.datasource_name LIKE :name', { name: `%${datasourceName}%` })
    }
    if (datasourceType) {
      qb.andWhere('ds.datasource_type = :type', { type: datasourceType })
    }

    const total = await qb.getCount()
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('ds.created_at', 'DESC')
      .getMany()

    const data: IDataSourceListItem[] = list.map(item => ({
      id: Number(item.id),
      datasourceName: item.datasourceName!,
      datasourceType: item.datasourceType as any,
      host: item.host!,
      port: item.port!,
      database: item.database!,
      username: item.username,
      status: (item.status as any) || 'unchecked',
      lastCheckTime: item.lastCheckTime?.toISOString(),
      description: item.description,
      createTime: item.createdAt?.toISOString(),
      updateTime: item.updatedAt?.toISOString(),
    }))

    return { data, total, page, pageSize }
  }

  async create(data: ICreateDataSourceReq): Promise<ResponseData<ICreateDataSourceRes>> {
    const existing = await this.dataSourceRepo.findOne({ where: { datasourceName: data.datasourceName } })
    if (existing) {
      return ResponseData.error('数据源名称已存在')
    }

    const entity = this.dataSourceRepo.create({
      datasourceName: data.datasourceName,
      datasourceType: data.datasourceType,
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username,
      password: data.password,
      description: data.description,
      status: 'unchecked',
    })

    const saved = await this.dataSourceRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), datasourceName: saved.datasourceName! })
  }

  async update(data: IUpdateDataSourceReq): Promise<ResponseData<IUpdateDataSourceRes>> {
    const entity = await this.dataSourceRepo.findOne({ where: { id: data.id } })
    if (!entity) {
      return ResponseData.error('数据源不存在')
    }

    if (data.datasourceName && data.datasourceName !== entity.datasourceName) {
      const existing = await this.dataSourceRepo.findOne({ where: { datasourceName: data.datasourceName } })
      if (existing) {
        return ResponseData.error('数据源名称已存在')
      }
      entity.datasourceName = data.datasourceName
    }
    if (data.datasourceType) entity.datasourceType = data.datasourceType
    if (data.host) entity.host = data.host
    if (data.port) entity.port = data.port
    if (data.database) entity.database = data.database
    if (data.username !== undefined) entity.username = data.username
    if (data.password !== undefined) entity.password = data.password
    if (data.description !== undefined) entity.description = data.description

    const saved = await this.dataSourceRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), datasourceName: saved.datasourceName! })
  }

  async delete(id: number): Promise<ResponseData<null>> {
    const entity = await this.dataSourceRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('数据源不存在')
    }
    await this.dataSourceRepo.remove(entity)
    return ResponseData.success(null)
  }

  async testConnection(id: number): Promise<ResponseData<ITestDataSourceConnectionRes>> {
    const entity = await this.dataSourceRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('数据源不存在')
    }

    // TODO: 实际连接测试逻辑，当前返回模拟结果
    const startTime = Date.now()
    entity.status = 'normal'
    entity.lastCheckTime = new Date()
    await this.dataSourceRepo.save(entity)

    return ResponseData.success({
      success: true,
      message: '连接成功',
      latency: Date.now() - startTime,
    })
  }
}
