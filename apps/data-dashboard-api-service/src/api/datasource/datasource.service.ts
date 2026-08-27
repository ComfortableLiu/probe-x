import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
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
    private configService: ConfigService,
  ) {}

  /**
   * 加密数据源密码（AES-256-GCM）
   * 存储格式：enc:v1:<iv>:<authTag>:<cipher>（均为 hex）
   * 加密开关关闭（DATASOURCE_ENCRYPT_ENABLED=false）时直接返回明文
   */
  private encryptPassword(plain: string): string {
    if (!plain || !this.isEncryptEnabled()) return plain
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptKey(), iv)
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
  }

  /**
   * 解密数据源密码
   * 非密文格式、未配置密钥或解密失败时按原值返回，兼容加密上线前的旧数据和开关关闭的场景
   */
  private decryptPassword(value: string): string {
    if (!value || !value.startsWith('enc:v1:')) return value
    const secret = this.configService.get<string>('datasource.encryptSecret') || ''
    if (!secret) return value
    try {
      const [, , ivHex, authTagHex, cipherHex] = value.split(':')
      const decipher = createDecipheriv('aes-256-gcm', this.getEncryptKey(), Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
      return Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]).toString('utf8')
    } catch {
      return value
    }
  }

  /**
   * 数据源密码加密开关（DATASOURCE_ENCRYPT_ENABLED，默认 true）
   */
  private isEncryptEnabled(): boolean {
    return this.configService.get<boolean>('datasource.encryptEnabled') !== false
  }

  /**
   * 由环境变量 DATASOURCE_ENCRYPT_SECRET 派生 32 字节密钥
   * （加密开启但未配置时服务启动即报错，见 configuration.ts）
   */
  private getEncryptKey(): Buffer {
    const secret = this.configService.get<string>('datasource.encryptSecret') || ''
    return createHash('sha256').update(secret).digest()
  }

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
      // 密码入库（加密开关开启时 AES-256-GCM 加密，关闭时明文）
      password: this.encryptPassword(data.password),
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
    // 密码更新时入库（加密开关开启时 AES-256-GCM 加密，关闭时明文）
    if (data.password !== undefined) entity.password = this.encryptPassword(data.password)
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
    // 读取时解密密码（解密失败按明文返回，兼容旧数据），供实际连接测试使用
    const decryptedPassword = this.decryptPassword(entity.password)
    void decryptedPassword
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
