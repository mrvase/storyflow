import type { Failure, Result, Success, UnwrapSuccess } from "./types";
export type { Failure, Result, Success, UnwrapSuccess };

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
  return isResult(result) && result.success;
}

export function isError<T>(result: Result<T>): result is Failure {
  return isResult(result) && !result.success;
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
