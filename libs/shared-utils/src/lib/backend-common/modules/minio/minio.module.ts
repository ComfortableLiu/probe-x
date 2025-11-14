import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MinioStorageService } from "./minio.service"

@Global() // 全局模块，所有业务模块可直接注入
@Module({
  imports: [ConfigModule],
  providers: [MinioStorageService],
  exports: [MinioStorageService],
})
export class MinIOModule {
}
