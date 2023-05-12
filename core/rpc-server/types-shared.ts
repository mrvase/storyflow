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

export type UnwrapSuccess<S, Or = never> = S extends Success<infer U> ? U : Or;

/* */

export type Output = Result<any> | Promise<Result<any>>;

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
