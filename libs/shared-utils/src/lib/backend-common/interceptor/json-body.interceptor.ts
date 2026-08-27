import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'

@Injectable()
export class JsonBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()

    // 只处理 POST 请求
    if (request.method === 'POST') {
      try {
        // 从 body 中获取 JSON 字符串并解析
        // 注意：根据实际情况调整获取 JSON 字符串的方式（如 request.rawBody 或 request.body）
        const jsonString = request.rawBody?.toString() || ''
        if (jsonString) {
          request.body = JSON.parse(jsonString) // 解析后覆盖原 body
        }
      } catch (error: any) {
        // 解析失败时抛出 400 Bad Request
        throw new BadRequestException(`Invalid JSON in request body: ${error.message}`)
      }
    }

    return next.handle()
  }
}
