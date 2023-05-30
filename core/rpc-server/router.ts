import { error, isError, isResult, success } from "./result";
import { z, ZodError, ZodType } from "zod";
import type {
  API,
  APIRoute,
  Output,
  QueryObject,
  MutationObject,
  Result,
  Failure,
} from "./types";
import type { Context, MiddlewareContext, SchemaInput } from "./types";

type Unwrap<I extends SchemaInput> = I extends ZodType ? z.infer<I> : undefined;

type Promisify<T> = Promise<Awaited<T>> & { abort: () => void };

type QueryObjectServer<
  C extends UserContext,
  I = any,
  O extends Output = Output
> = {
  query: (input: I, context: Context & C) => O;
};

type MutationObjectServer<
  C extends UserContext,
  I = any,
  O extends Output = Output
> = {
  mutation: (input: I, context: Context & C) => O;
};

type MiddlewareMethod<C extends UserContext> = {
  middleware?: (ctx: MiddlewareContext) => Promise<C>;
};

type SchemaMethod<I extends SchemaInput> = {
  schema?: () => I;
};

type RedirectMethod<O extends Output> = {
  redirect?: (result: Awaited<O> | Failure) => string | void;
};

type UserContext = Record<string, any>;

const message = "Server error.";

const errorProxy = new Proxy(
  {},
  {
    get: () => {
      throw new Error(
        "You are making a local procedure call, but the procedure relies on HTTP context (headers or cookies)."
      );
    },
  }
);

const getProcedureType = (
  action: { query: unknown } | { mutation: unknown }
) => {
  if ("query" in action) {
    return "query";
  }
  if ("mutation" in action) {
    return "mutation";
  }
  throw new Error("Invalid procedure");
};

export function preconfigure<C1 extends UserContext>(
  object: MiddlewareMethod<C1>
) {
  return function <
    C2 extends UserContext,
    I extends SchemaInput,
    O extends Output
  >(
    action: Methods<C2, I, O> &
      (
        | QueryObjectServer<C1 & C2, Unwrap<I>, O>
        | MutationObjectServer<C1 & C2, Unwrap<I>, O>
      )
  ) {
    return createProcedure<C1 & C2, I, O>({
      async middleware(ctx: MiddlewareContext) {
        return ctx.use(
          ...[object.middleware, action.middleware].filter(
            (el): el is Exclude<typeof el, undefined> => Boolean(el)
          )
        );
      },
      ...action,
    } as any);
  };
}

type Methods<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
> = MiddlewareMethod<C> & SchemaMethod<I> & RedirectMethod<O>;

export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: Methods<C, I, O> & QueryObjectServer<C, Unwrap<I>, O>
): QueryObject<Unwrap<I>, Promisify<O>>;
export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: Methods<C, I, O> & MutationObjectServer<C, Unwrap<I>, O>
): MutationObject<Unwrap<I>, Promisify<O>>;
export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: Methods<C, I, O> &
    (QueryObjectServer<C, Unwrap<I>, O> | MutationObjectServer<C, Unwrap<I>, O>)
):
  | QueryObject<Unwrap<I>, Promisify<O>>
  | MutationObject<Unwrap<I>, Promisify<O>> {
  const type = getProcedureType(action);

  const handleProcedure = async function (
    this:
      | { method: string; context: Context }
      | { method?: undefined; context?: undefined },
    input: any
  ) {
    const isHTTPRequest = typeof this.method !== "undefined";

    const context = Object.create({ use });
    Object.assign(context, this.context ?? errorProxy);

    let result: Result<any>;

    try {
      if (isHTTPRequest) {
        await action.middleware?.(context);
      }

      if (this.method === "OPTIONS") {
        return success(null);
      }

      if (action.schema) {
        (action.schema() as ZodType).parse(input);
      }
      const initial = await (action as QueryObjectServer<C, Unwrap<I>, O>)[
        type as "query"
      ].call(this, input, { ...context });
      // Pass "this" on so procedures can call each other.
      // Spread of context removes the "use" prototype method.

      result = initial;
    } catch (err) {
      if (err instanceof ZodError) {
        result = error({
          message: "Invalid input",
          status: 400,
        });
      } else if (!isResult(err) || !isError(err)) {
        console.error(err);
        result = error({ message, detail: err });
      } else {
        console.error(err);
        result = err;
      }
    }

    const redirect = action.redirect?.(result as Awaited<O>);

    if (isHTTPRequest && this.context && typeof redirect === "string") {
      this.context.response.redirect = redirect;
      return result;
    }

    return result;
  };

  return {
    [type]: handleProcedure,
  } as QueryObject<Unwrap<I>, Promisify<O>>;
}

export function createRoute<T extends APIRoute>(route: T): T {
  return route;
}

const use: MiddlewareContext["use"] = async function use(this: any, ...fns) {
  for (const fn of fns) {
    const result = await fn(this);
    Object.assign(this, result);
  }
  return this;
};
