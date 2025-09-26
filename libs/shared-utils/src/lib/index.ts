export function isUndefined(value: unknown) {
  return value === undefined
}

export function isEmpty(value: unknown) {
  return value === null || value === '' || value === undefined
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