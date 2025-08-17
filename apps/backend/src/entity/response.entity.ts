export class ResponseData<T> {
  constructor(
    public code: number = 200,
    public message: string = 'success',
    public data: T | null = null,
    public timestamp: number = Date.now(),
  ) {
  }

  static success<T>(data?: T): ResponseData<T> {
    return new ResponseData(200, 'success', data);
  }

  static error<T>(message: string, code: number = -1): ResponseData<T | null> {
    return new ResponseData(code, message, null);
  }
}
