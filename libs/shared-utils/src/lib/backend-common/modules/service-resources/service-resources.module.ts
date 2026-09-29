import { DynamicModule, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { RedisModule } from '../redis/redis.module'
import { RedisService } from '../redis/redis.service'
import { ServiceResourceMonitor } from '../../service-resource-monitor.cjs'

@Injectable()
class ResourceReporter implements OnModuleInit, OnModuleDestroy {
  private readonly monitor: ServiceResourceMonitor

  constructor(redis: RedisService, serviceKey: string) {
    const logger = new Logger(`ServiceResources:${serviceKey}`)
    this.monitor = new ServiceResourceMonitor(redis.getClient(), {
      serviceKey,
      onError: error => logger.warn(`资源采样暂不可用: ${error.message}`),
    })
  }

  onModuleInit() { this.monitor.start() }
  async onModuleDestroy() { await this.monitor.stop() }
}

@Module({})
export class ServiceResourcesModule {
  static forService(serviceKey: string): DynamicModule {
    return {
      module: ServiceResourcesModule,
      imports: [RedisModule.forRoot()],
      providers: [{
        provide: ResourceReporter,
        useFactory: (redis: RedisService) => new ResourceReporter(redis, serviceKey),
        inject: [RedisService],
      }],
    }
  }
}
