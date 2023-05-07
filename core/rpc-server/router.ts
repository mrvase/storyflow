import { error, isError, isResult } from "./result";
import { z, ZodError, ZodType } from "zod";
import type {
  API,
  APIRoute,
  Output,
  QueryObject,
  MutationObject,
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

type APIObject<C extends UserContext, I extends SchemaInput> = {
  schema?: () => I;
  middleware?: (ctx: MiddlewareContext) => Promise<C>;
};

type UserContext = Record<string, any>;

const message = "Server error.";

const errorProxy = new Proxy(
  {},
  {
    get: () => {
      throw new Error(
        "You are making an RPC which needs HTTP context through the local API."
      );
    },
  }
);

export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: APIObject<C, I> & QueryObjectServer<C, Unwrap<I>, O>
): QueryObject<Unwrap<I>, Promisify<O>>;
export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: APIObject<C, I> & MutationObjectServer<C, Unwrap<I>, O>
): MutationObject<Unwrap<I>, Promisify<O>>;
export function createProcedure<
  C extends UserContext,
  I extends SchemaInput,
  O extends Output
>(
  action: APIObject<C, I> &
    (QueryObjectServer<C, Unwrap<I>, O> | MutationObjectServer<C, Unwrap<I>, O>)
):
  | QueryObject<Unwrap<I>, Promisify<O>>
  | MutationObject<Unwrap<I>, Promisify<O>> {
  const type = "query" in action ? "query" : "mutation";

  return {
    [type]: async function (input: any) {
      const context = Object.create({ use });
      Object.assign(context, this.context ?? errorProxy);
      try {
        await action.middleware?.(context);

        if (this.method === "OPTIONS") return;

        if (action.schema) {
          (action.schema() as ZodType).parse(input);
        }
        return await (action as QueryObjectServer<C, Unwrap<I>, O>)[
          type as "query"
        ].call(this, input, { ...context });
        // Pass "this" on so procedures can call each other.
        // Spread of context removes the "use" prototype method.
      } catch (err) {
        if (err instanceof ZodError) {
          return error({
            message: "Invalid input",
            status: 400,
            detail: err.message,
          });
        }
        if (!isResult(err) || !isError(err)) {
          console.error(err);
          return error({ message, detail: err });
        }
        console.error(err);
        return err;
      }
    },
  } as QueryObject<Unwrap<I>, Promisify<O>>;
}

export function createRoute<T extends APIRoute>(route: T): T {
  return route;
}

export function createAPI<T extends API>(router: T): T {
  return router;
}

const use: MiddlewareContext["use"] = async function use(...fns) {
  for (const fn of fns) {
    const result = await fn(this);
    Object.assign(this, result);
  }
  return this;
};
