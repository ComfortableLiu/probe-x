import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // 连接Kafka微服务
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'preliminary-data-processing-service',
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'preliminary-processing-group',
      },
    },
  });

  await app.startAllMicroservices();
  
  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`初步数据处理服务已启动，端口: ${port}`);
  console.log('Kafka消费者已启动，等待消息...');
}

bootstrap();
