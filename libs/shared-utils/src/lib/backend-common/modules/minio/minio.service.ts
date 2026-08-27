import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { Client } from 'minio'
import { Readable } from 'stream'
import { ConfigService } from '@nestjs/config'
import { MinioModuleOptions } from "./type"

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name)
  private readonly minioClient: Client
  private readonly defaultBucket: string

  constructor(private configService: ConfigService) {
    // 从 .env 读取配置
    const minioConfig: MinioModuleOptions = {
      host: this.configService.get<string>('minio.host', ''),
      port: this.configService.get<string>('minio.port', ''),
      accessKey: this.configService.get<string>('minio.accessKey', ''),
      secretKey: this.configService.get<string>('minio.secretKey', ''),
      useSSL: this.configService.get<boolean>('minio.useSSL', false),
      bucket: this.configService.get<string>('minio.bucket', ''),
      downloadExpires: this.configService.get<number>('minio.downloadExpires', 86400),
    }

    // 初始化 MinIO 客户端
    this.minioClient = new Client({
      endPoint: minioConfig.host,
      port: parseInt(minioConfig.port),
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
    })

    this.defaultBucket = minioConfig.bucket
  }

  // 模块初始化时验证桶是否存在（await 等待完成，失败则阻止启动）
  async onModuleInit() {
    try {
      await this.ensureBucketExists(this.defaultBucket)
    } catch (err: any) {
      this.logger.error(`MinIO 桶验证失败：${err.message}`, err.stack)
      throw new Error(`MinIO 连接失败，请检查配置和服务器状态`)
    }
  }

  /** 确保桶存在，不存在则创建（兜底） */
  async ensureBucketExists(bucketName: string): Promise<void> {
    const exists = await this.minioClient.bucketExists(bucketName)
    if (!exists) {
      await this.minioClient.makeBucket(bucketName)
      this.logger.log(`MinIO 桶创建成功：${bucketName}`)
    } else {
      this.logger.log(`MinIO 桶已存在：${bucketName}`)
    }
  }

  /** 流式上传文件（适配 Excel 生成场景） */
  async uploadStream(
    stream: Readable,
    fileName: string,
    contentType: string,
    bucketName = this.defaultBucket,
  ): Promise<string> {
    await this.ensureBucketExists(bucketName)

    // 按日期分目录存储（如：exports/2025-11-15/task-xxx.xlsx）
    const dateDir = new Date().toISOString().split('T')[0]
    const fileKey = `exports/${dateDir}/${fileName}`

    // 上传文件流
    await this.minioClient.putObject(bucketName, fileKey, stream, undefined, {
      'Content-Type': contentType,
    })

    this.logger.log(`文件上传成功：bucket=${bucketName}, key=${fileKey}`)
    return fileKey
  }

  /** 生成预签名下载链接 */
  async getPresignedDownloadUrl(
    fileKey: string,
    expires = this.configService.get<number>('minio.downloadExpires', 30 * 60),
    bucketName = this.defaultBucket,
  ): Promise<string> {
    // 校验文件是否存在
    const fileExists = await this.minioClient.statObject(bucketName, fileKey).catch(() => false)
    if (!fileExists) {
      throw new NotFoundException(`文件不存在：${fileKey}`)
    }

    // 生成带时效的链接
    return await this.minioClient.presignedUrl('GET', bucketName, fileKey, expires)
  }

  /** 删除文件（用于清理过期资源） */
  async deleteFile(fileKey: string, bucketName = this.defaultBucket): Promise<void> {
    try {
      await this.minioClient.removeObject(bucketName, fileKey)
      this.logger.log(`文件删除成功：${fileKey}`)
    } catch (err: any) {
      this.logger.error(`文件删除失败：${fileKey}`, err.stack)
    }
  }

  /** 获取原始客户端（如需扩展自定义操作） */
  getClient(): Client {
    return this.minioClient
  }
}
