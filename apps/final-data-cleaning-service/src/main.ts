import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '@src/app.module'
import { NodeConnectionService } from '@src/service/node-connection.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 计算节点以 HTTP /health 暴露自身链接状态，供部署健康检查与运维排查；
  // 与总服务的通信是「拨出」的 gRPC 流，本端口不需要对外发布
  const nodeConnection = app.get(NodeConnectionService)
  app.getHttpAdapter().get('/health', (_req, res) => {
    res.json({
      status: nodeConnection.linkStatus === 'connected' ? 'ok' : 'degraded',
      ...nodeConnection.getSnapshot(),
    })
  })

  // 启用优雅关机钩子，保证进程退出前正确释放 gRPC 连接
  app.enableShutdownHooks()

  const port = parseInt(process.env.PORT || '', 10) || 10000
  await app.listen(port)

  console.log(
    `计算节点 ${nodeConnection.getSnapshot().nodeId} 已启动，/health 监听 ${port} 端口`,
  )
}

bootstrap()
