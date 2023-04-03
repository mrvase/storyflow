export const modifyValues = <T extends any, V extends Record<string, any>>(
  obj: V,
  callback: (val: V[keyof V]) => T
): { [Key in keyof V]: T } =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, callback(value)])
  ) as { [Key in keyof V]: T };
