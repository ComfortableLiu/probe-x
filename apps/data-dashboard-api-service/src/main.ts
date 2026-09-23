import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from "@src/app.module"
import { ValidationPipe } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import {
  AllExceptionsFilter,
  resolveProtoPath,
} from "@probe-x/shared-utils/src/lib/backend-common"
import { ConfigService } from "@nestjs/config"

const PROTO_PACKAGE = 'final_data_cleaning_control_bi_stream'

// 必须与计算节点客户端逐项一致，否则字段名/默认值对不上：
// keepCase 保证 task_id、node_id 等 snake_case 字段原样进出（NestJS 默认会转成 camelCase）
const PROTO_LOADER = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
}

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

  // 计算节点接入：在 HTTP 之外再挂一个 gRPC 监听。
  // 节点作为客户端拨出连接到 NODE_CONTROL_PORT，本服务不需要知道节点在哪。
  const nodeControlPort = configService.get('nodeControl.port')
  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: PROTO_PACKAGE,
      protoPath: resolveProtoPath(PROTO_PACKAGE),
      url: `0.0.0.0:${nodeControlPort}`,
      loader: PROTO_LOADER,
    },
  })
  await app.startAllMicroservices()
  console.log(`计算节点接入端口已就绪，端口: ${nodeControlPort}`)

  const port = process.env.PORT || parseInt(configService.get('services.dataDashboardApi.port', '8101'))
  await app.listen(port)
  console.log(`数据仪表板API服务已启动，端口: ${port}`)
}

bootstrap()
