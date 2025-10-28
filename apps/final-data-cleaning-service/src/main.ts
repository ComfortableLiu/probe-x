import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from "@nestjs/config"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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
        clientId: configService.get('kafka.clientId', 'localhost:9092'),
        brokers: configService.get('kafka.brokers', ['localhost:9092']),
      },
      consumer: {
        groupId: configService.get('kafka.groupId', 'localhost:9092'),
      },
    },
  })

  await app.startAllMicroservices()

  const port = process.env.PORT || parseInt(configService.get('services.finalDataCleaning.port', '8102'))
  await app.listen(port)
  console.log(`最终数据清洗服务已启动，端口: ${port}`)
  console.log('Kafka消费者已启动，等待消息...')
}

bootstrap()
