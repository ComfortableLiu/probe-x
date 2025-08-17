/**
 * 具有任意属性的对象
 */
export interface IAnyObj<T = unknown> {
  [propName: string]: T
}

/**
 * 任意的函数
 */
export type IAnyFn = (...args: unknown[]) => unknown

