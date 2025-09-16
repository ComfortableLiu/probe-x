export class BusinessException extends Error {
  constructor(
    public message: string,
    public code: number = -100,
  ) {
    super(message);
  }
}
