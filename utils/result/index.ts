export type Success<T> = {
  success: true;
  result: T;
};

export type Failure = {
  success: false;
  message: string;
  detail?: any;
  status?: number;
};

export type Result<T = any> = Success<T> | Failure;

export type UnwrapResult<R, Or = never> = R extends Success<infer U> ? U : Or; // must use "Success" to work
export type UnwrapSuccess<S, Or = never> = S extends Success<infer U> ? U : Or;

export function success<T>(data: T): Success<T> {
  return {
    success: true,
    result: data,
  };
}

export function error({
  message,
  detail,
  status,
}: {
  message: string;
  detail?: any;
  status?: number;
}): Failure {
  return {
    success: false,
    message,
    detail,
    status,
  };
}

export function isResult(result: any): result is Result<any> {
  return (
    result !== null &&
    typeof result === "object" &&
    "success" in result &&
    typeof result.success === "boolean"
  );
}

export function isSuccess<T>(result: Result<T>): result is Success<T> {
  if (!isResult(result)) {
    return false;
  }
  return result.success === true;
}

export function isError<T>(result: Result<T>): result is Failure {
  if (!isResult(result)) {
    return false;
  }
  return result.success === false;
}

export function unwrap<T extends Result, X>(
  result: T
): UnwrapSuccess<T, undefined>;
export function unwrap<T extends Result, X>(
  result: T,
  or: X
): UnwrapSuccess<T, X>;
export function unwrap<T extends Result, X>(
  result: T,
  or?: X
): UnwrapSuccess<T, X> {
  return (isSuccess(result) ? result.result : or) as T extends Success<infer V>
    ? V
    : X;
}

export function modify<T, V>(
  result: Result<T>,
  callback: (result: T) => V
): Result<V> {
  if (isError(result)) return result;
  return success(callback(unwrap(result)));
}

export async function modifyAsync<T, V>(
  result: Result<T>,
  callback: (result: T) => Promise<V>
): Promise<Result<V>> {
  if (isError(result)) return result;
  return success(await callback(unwrap(result)));
}
