import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MinioService } from "./minio.service"

@Global() // 全局模块，所有业务模块可直接注入
@Module({
  imports: [ConfigModule],
  providers: [MinioService],
  exports: [MinioService],
})
export class MinIOModule {
}
