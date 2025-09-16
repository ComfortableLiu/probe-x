/**
 * 具有任意属性的对象
 */
export interface IAnyObj<T = any> {
  [propName: string]: T
}

/**
 * 任意的函数
 */
export type IAnyFn = (...args: any[]) => any

