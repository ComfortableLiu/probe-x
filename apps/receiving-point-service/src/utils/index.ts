export const isString = (val: unknown): boolean => Object.prototype.toString.call(val) === '[object String]'
