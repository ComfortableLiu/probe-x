export function isUndefined(value: unknown) {
  return value === undefined;
}

export function isEmpty(value: unknown) {
  return value === null || value === '' || value === undefined;
}
