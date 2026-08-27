import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { ComputeNodeService } from "@src/service/node.service"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { AppModule } from "@src/app.module"

async function bootstrap() {
  const port = process.env.PORT || 10000

  // @ts-ignore
  const __filename = fileURLToPath(import.meta.url)
  const finalDataCleaningServicePath = path.dirname(__filename)

  // 计算节点作为 gRPC 服务端启动
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'final_data_cleaning_control_bi_stream',
      protoPath: path.resolve(finalDataCleaningServicePath, '../proto/final_data_cleaning_control_bi_stream.proto'),
      url: `0.0.0.0:${port}`,
    },
  })

  // 启用优雅关机钩子，保证进程退出前正确释放资源
  app.enableShutdownHooks()

  await app.listen()

  const nodeService = app.get(ComputeNodeService)
  console.log(`计算节点 ${nodeService.nodeId} 启动，监听 ${port} 端口`)
}

bootstrap()
