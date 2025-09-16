import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { Request, Response } from 'express';
import { ResponseData } from "@entity/response.entity";
import { BusinessException } from "./business.exception";
import { isString } from "@src/utils";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let message = 'Internal server error';
    let status = 500;
    let code = -1;

    // 处理HTTP异常
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (isString(exceptionResponse)) {
        message = exceptionResponse as string;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        // 处理 ValidationPipe 的异常
        if ('message' in exceptionResponse) {
          if (Array.isArray(exceptionResponse.message)) {
            message = exceptionResponse.message.join(', ');
          } else {
            message = exceptionResponse.message as string;
          }
        }
      }
      // 记录错误日志，这里先直接log了一下
      console.error(`[${request.method}] ${request.url}`, exception);
    }
    // 处理自定义业务异常（可以扩展这部分）
    else if (exception instanceof BusinessException) {
      // 业务异常的网络状态码可以直接为200
      status = 200
      message = exception.message;
      // 可以基于错误类型设置不同的code
      if (exception.name === 'QueryFailedError') {
        code = -2; // 数据库错误
      }
    }

    // 返回统一格式的错误响应
    response.status(status).json(
      ResponseData.error(message, code)
    );
  }
}
