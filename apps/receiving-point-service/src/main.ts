import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from "@probe-x/shared-utils/src/lib/backend-common"
import { ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 启用优雅关机钩子，保证进程退出前正确释放资源
  app.enableShutdownHooks()

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

  // 启用CORS
  // credentials: true 是必需的——sendBeacon 的凭据模式固定为 include（会携带 Cookie），
  // 响应缺少 Access-Control-Allow-Credentials 时浏览器会拦截并阻断上报（预检失败导致 POST 根本发不出）。
  // 安全风险可控：origin: true 只是把请求来源反射回 ACAO（已存在的行为），且本服务是埋点数据接收端，
  // 响应体不含敏感数据，也不做基于 Cookie 的身份认证，不存在凭据泄露面
  app.enableCors({
    origin: true,
    credentials: true,
  })

  // 全局注册异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter())

  const port = process.env.PORT || parseInt(configService.get('services.receivingPoint.port', '8104'))
  await app.listen(port)
  console.log(`埋点接受服务已启动，端口: ${port}`)
}

bootstrap()
