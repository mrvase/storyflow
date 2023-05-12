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

type APIObject<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
> = {
  schema?: () => I;
  middleware?: (ctx: MiddlewareContext) => Promise<C>;
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

export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: APIObject<C, I, O> & QueryObjectServer<C, Unwrap<I>, O>
): QueryObject<Unwrap<I>, Promisify<O>>;
export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: APIObject<C, I, O> & MutationObjectServer<C, Unwrap<I>, O>
): MutationObject<Unwrap<I>, Promisify<O>>;
export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: APIObject<C, I, O> &
    (QueryObjectServer<C, Unwrap<I>, O> | MutationObjectServer<C, Unwrap<I>, O>)
):
  | QueryObject<Unwrap<I>, Promisify<O>>
  | MutationObject<Unwrap<I>, Promisify<O>> {
  const type = "query" in action ? "query" : "mutation";

  const handleProcedure = async function (input: any) {
    const context = Object.create({ use });
    Object.assign(context, this.context ?? errorProxy);

    let result: Result<any>;

    try {
      if (this.method) {
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

    if (typeof redirect === "string") {
      console.log("REDIRECT RESULT", result);
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

/*
export function createAPI<T extends API>(router: T): T {
  return router;
}
*/

const use: MiddlewareContext["use"] = async function use(...fns) {
  for (const fn of fns) {
    const result = await fn(this);
    Object.assign(this, result);
  }
  return this;
};
