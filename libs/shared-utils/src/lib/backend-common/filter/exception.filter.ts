import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common"
import { Request, Response } from 'express'
import { BusinessException } from "../exception/business.exception"
import { ResponseData } from "../entity/response.entity"
import { isString } from "../../index"

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let message = 'Internal server error'
    let status = 500
    let code = -1

    // 处理HTTP异常
    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (isString(exceptionResponse)) {
        message = exceptionResponse as string
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        // 处理 ValidationPipe 的异常
        if ('message' in exceptionResponse) {
          if (Array.isArray(exceptionResponse.message)) {
            message = exceptionResponse.message.join(', ')
          } else {
            message = exceptionResponse.message as string
          }
        }
        if ('code' in exceptionResponse) {
          code = exceptionResponse.code as number || -1
        }
      }
    }
    // 处理自定义业务异常（可以扩展这部分）
    else if (exception instanceof BusinessException) {
      // 业务异常的网络状态码可以直接为200
      status = 200
      message = exception.message
      // 直接使用业务异常携带的错误码
      code = exception.code
    }

    console.error(`[${request.method}] ${request.url}`, exception)

    // 返回统一格式的错误响应
    response.status(status).json(
      ResponseData.error(message, code),
    )
  }
}
