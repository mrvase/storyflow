export function clone<T>(value: T): T {
  function recursive<T>(value: T): T {
    if (!value || typeof value !== "object") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(recursive) as T;
    } else {
      const object = {} as T;
      Object.entries(value).forEach(([key, value]) => {
        (object as any)[key] = recursive(value);
      });
      return object;
    }
  }
  return recursive(value);
}
