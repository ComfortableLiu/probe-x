import 'reflect-metadata'
import { register } from 'tsconfig-paths'
import * as path from 'path'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'

// 在任何别名 import 之前注册运行时路径别名（指向编译后 dist 目录）
register({
  baseUrl: path.resolve(__dirname, '..'),
  paths: {
    '@src/*': ['src/*'],
    '@entity/*': ['src/entity/*'],
    '@modules/*': ['src/modules/*'],
    '@shared-types': ['../../libs/shared-types'],
    '@shared-utils': ['../../libs/shared-utils'],
    '@shared-utils/backend-common': ['../../libs/shared-utils/lib/backend-common'],
  },
})

async function bootstrap() {
  const { AppModule } = await import('./app.module')
  const app = await NestFactory.create(AppModule)

  // 动态导入，确保在路径注册之后再解析
  const { AllExceptionsFilter } = require('@shared-utils/backend-common')

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
  app.enableCors({
    origin: true,
    credentials: true,
  })

  // 全局注册异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter())

  const port = process.env.SERVICE_POST || 3001
  await app.listen(port)
  console.log(`数据仪表板API服务已启动，端口: ${port}`)
}

bootstrap()
