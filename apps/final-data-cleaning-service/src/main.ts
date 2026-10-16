import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '@src/app.module'
import { NodeConnectionService } from '@src/service/node-connection.service'
import { installNodeLogCapture } from '@src/lib/node-log-buffer'
import { healthListenPort } from '@src/lib/node-endpoint'

async function bootstrap() {
  // 必须在 NestFactory.create 之前安装：NestJS 内置 Logger 底层走 console，
  // 提前包装才能捕获启动阶段的全部日志，供总服务侧的节点日志页展示
  installNodeLogCapture()

  const app = await NestFactory.create(AppModule)

  // 计算节点以 HTTP /health 暴露自身链接状态，供部署健康检查与运维排查；
  // 与总服务的通信是「拨出」的 gRPC 流，本端口不需要对外发布
  const nodeConnection = app.get(NodeConnectionService)
  nodeConnection.requireHealthEndpoint()
  app.getHttpAdapter().get('/health', (_req, res) => {
    res.json({
      status: nodeConnection.linkStatus === 'connected' ? 'ok' : 'degraded',
      ...nodeConnection.getSnapshot(),
    })
  })

  // 启用优雅关机钩子，保证进程退出前正确释放 gRPC 连接
  app.enableShutdownHooks()

  const port = healthListenPort(process.env.PORT)
  await app.listen(port, process.env.HOST || '0.0.0.0')
  const endpoint = app.getHttpServer().address()
  if (!endpoint || typeof endpoint === 'string') throw new Error('无法获取健康检查实际监听地址')
  nodeConnection.setHealthEndpoint(endpoint.address, endpoint.port)

  console.log(
    `计算节点 ${nodeConnection.getSnapshot().nodeId} 已启动，/health 监听 ${endpoint.address}:${endpoint.port}`,
  )
}

bootstrap()
