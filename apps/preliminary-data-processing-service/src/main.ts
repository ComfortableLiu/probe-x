import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from "@nestjs/config"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 启用优雅关机钩子，保证进程退出前正确释放资源（如 Kafka 连接）
  app.enableShutdownHooks()

  // 从应用实例中获取 ConfigService
  const configService = app.get(ConfigService)

  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }))

  // 连接Kafka微服务
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        // 默认使用服务名作为 clientId，避免误用 broker 地址字符串
        clientId: configService.get('kafka.clientId', 'preliminary-data-processing-service'),
        brokers: configService.get('kafka.brokers', ['localhost:9092']),
      },
      consumer: {
        // 为消费组提供更合理的默认名称
        groupId: configService.get('kafka.groupId', 'preliminary-data-processing-consumer'),
      },
      run: {
        // 接 configuration.ts 的消费配置（原先未被使用的死配置）
        // 默认关闭自动提交，eachMessage 处理成功后由消费者手动 commitOffsets
        autoCommit: configService.get('kafka.consumerEnableAutoCommit', false),
        autoCommitInterval: configService.get('kafka.consumerAutoCommitInterval', 5000),
      },
    },
  })

  await app.startAllMicroservices()

  const port = process.env.PORT || parseInt(configService.get('services.preliminaryDataProcessing.port', '3002'))
  await app.listen(port)
  console.log(`初步数据处理服务已启动，端口: ${port}`)
  console.log('Kafka消费者已启动，等待消息...')
}

bootstrap()
