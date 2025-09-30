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
