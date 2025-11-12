export function isUndefined(value: unknown) {
  return value === undefined
}

export function isEmpty(value: unknown) {
  return value === null || value === '' || value === undefined
}

export const isString = (value: unknown): boolean => Object.prototype.toString.call(value) === '[object String]'

export const isNumber = (value: unknown): boolean => Object.prototype.toString.call(value) === '[object Number]'

/**
 * 校验是否可以转换为数字
 * @param value
 */
export const checkNumber = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return false
  const num = Number(value)
  return Number.isFinite(num)
}

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
