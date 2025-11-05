export function isUndefined(value: unknown) {
  return value === undefined
}

export function isEmpty(value: unknown) {
  return value === null || value === '' || value === undefined
}

export const isString = (val: unknown): boolean => Object.prototype.toString.call(val) === '[object String]'

/**
 * 延时函数
 * @param time
 */
export function delay(time = 1000) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, time)
  })
}

/**
 * 深拷贝数组
 */
export function deepCopyArray<T>(arr: T[]): T[] {
  return JSON.parse(JSON.stringify(arr))
}

/**
 * 小驼峰转下划线
 */
export function camelToUnderline(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/**
 * 下划线转小驼峰
 */
export function underlineToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}
