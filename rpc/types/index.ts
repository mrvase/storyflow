import type { Result as _Result } from "@storyflow/result";

export type Result<T> = _Result<T>;

export type Output = Result<any> | void | Promise<Result<any> | void>;

export type OptionalParamFunc<
  Input,
  ReturnValue,
  Args extends any[] = []
> = Input extends undefined
  ? (input?: Input | undefined, ...args: Args) => ReturnValue
  : (input: Input, ...args: Args) => ReturnValue;

export type QueryObject<I = any, O extends Output = Output> = {
  query: OptionalParamFunc<I, O>;
};

export type MutationObject<I = any, O extends Output = Output> = {
  mutation: OptionalParamFunc<I, O>;
};

export type APIRoute = {
  [key: string]: QueryObject | MutationObject;
};

export type API = {
  [key: string]: APIRoute;
};
