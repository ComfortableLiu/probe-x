import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
import { map, Observable } from 'rxjs'
import { ResponseData } from "@entity/response.entity"

@Injectable()
export class ResponseInterceptor implements NestInterceptor {

  intercept(_context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    return next.handle()
      .pipe(
        map((data: any) => {
          // 如果已经是ResponseData格式，直接返回
          if (data instanceof ResponseData) {
            return data
          }

          // 否则包装成统一格式
          return new ResponseData(200, 'success', data)
        }),
      )
  }
}
