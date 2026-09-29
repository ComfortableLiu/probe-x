import { Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { RuntimeMetricsService } from './runtime-metrics.service'

@Injectable()
export class RuntimeMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: RuntimeMetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Dashboard polling must not manufacture its own traffic/performance samples.
    if (!req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/api/system-data/')) {
      next()
      return
    }
    const start = performance.now()
    let businessError = false
    const json = res.json
    res.json = function (body) {
      businessError = typeof body?.code === 'number' && body.code !== 200
      return json.call(this, body)
    }
    res.once('finish', () => this.metrics.record(performance.now() - start, res.statusCode, businessError))
    next()
  }
}
