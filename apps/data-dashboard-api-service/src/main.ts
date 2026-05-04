import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from "@src/app.module"
import { ValidationPipe } from '@nestjs/common'
import { AllExceptionsFilter } from "@probe-x/shared-utils/src/lib/backend-common/index"
import { ConfigService } from "@nestjs/config"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 从应用实例中获取 ConfigService
  const configService = app.get(ConfigService)

  // 启用全局验证管道，用于自动验证请求数据
  // transform: true - 自动将请求数据转换为 DTO 类型实例
  // whitelist: true - 自动过滤掉 DTO 中未定义的属性
  // forbidNonWhitelisted: true - 当存在 DTO 中未定义的属性时抛出错误
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }))

  // 启用CORS并配置具体的跨域选项
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [`http://localhost:${configService.get('client.port', 8000)}`]
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  })

  // 全局注册异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter())

  app.setGlobalPrefix('api')

  const port = process.env.PORT || parseInt(configService.get('services.dataDashboardApi.port', '8101'))
  await app.listen(port)
  console.log(`数据仪表板API服务已启动，端口: ${port}`)
}

bootstrap()
