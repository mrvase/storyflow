import qs from "qs";
import { error, isError, isResult, success } from "./result";
import type {
  API,
  Context,
  MutationObject,
  QueryObject,
  RPCResponse,
  RequestCookie,
  ResponseCookie,
  RequestCookies,
  Result,
  Failure,
} from "./types";
import type { RPCRequest } from "./types";
import { parse, serialize } from "cookie";
import { decode, encode } from "./crypto";

const isPrimitive = (obj: any) => {
  return (
    obj === null ||
    ["string", "boolean", "number", "undefined", "symbol"].includes(typeof obj)
  );
};

const modifyJSONPrimitives = (
  obj: object,
  callback: (value: any) => any
): any => {
  if (isPrimitive(obj)) {
    return callback(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((el) => modifyJSONPrimitives(el, callback));
  } else {
    let newObject: Record<string | number | symbol, any> = {};
    Object.entries(obj).forEach(([key, value]) => {
      newObject[key] = modifyJSONPrimitives(value, callback);
    });
    return newObject;
  }
};

const handleTypes = (object: object) => {
  return modifyJSONPrimitives(object, (value) => {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    let int = parseInt(value, 10);
    if (value === String(int)) {
      return int;
    }
    return value;
  });
};

const getInputFromUrl = (url: string | undefined) => {
  const query = (url ?? "").split("?")[1] ?? "";
  const parsedQuery = qs.parse(query);
  return parsedQuery as { query: any; ctx: any };
};

const getInput = (req: RPCRequest, body: any) => {
  if (req.method === "GET") {
    return handleTypes(getInputFromUrl(req.url));
  }
  if (req.method === "POST") {
    return {
      ctx: handleTypes(getInputFromUrl(req.url))?.ctx ?? {},
      query: body?.query ?? {},
    };
  }
  return undefined;
};

export async function handleRequest<T extends API>(
  { body, ...request }: RPCRequest & { body?: any },
  router: T,
  options: {
    secret?: string;
  } = {}
): Promise<{ data?: any; init: RPCResponse }> {
  const { route, procedure } = request;

  const id = Math.random().toString(36).substring(2, 6);

  console.log("REQUEST", `${route}/${procedure}`, request.method);
  console.time(`REQUEST TIME ${route}/${procedure} ${id}`);

  if (
    !route ||
    !procedure ||
    typeof route !== "string" ||
    typeof procedure !== "string"
  ) {
    console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
    console.log("\n\n");
    return {
      data: error({ message: "API route not found." }),
      init: {
        headers: new Headers(),
        status: 404,
      },
    };
  }

  const action =
    request.method === "GET"
      ? "query"
      : request.method === "POST"
      ? "mutation"
      : undefined;

  const cookies = parse(request.headers.get("cookie") ?? "");

  const entries: [string, any][] = [];

  Object.entries(cookies).forEach(([prefixedName, string]) => {
    const [prefix, env, ...rest] = prefixedName.split(".");
    const name = rest.join(".");
    if (
      options.secret &&
      prefix === "sf" &&
      ["e", "s", "c"].includes(env) &&
      name !== ""
    ) {
      let value: unknown = string;
      if (env !== "c") {
        value = decode(string, {
          secret: options.secret,
          decrypt: env === "e",
        });
        if (!value) return;
      }
      entries.push([name, { name, value }]);
    }
  });

  const setCookies = new Map<string, ResponseCookie>();

  const input = getInput(request, body);

  const context: Context = {
    request: {
      ...request,
      cookies<T extends Record<string, any>>() {
        return new Map<string, RequestCookie>(entries) as RequestCookies<T>;
      },
    },
    response: {
      headers: new Headers(),
      status: 200,
      cookies<T>() {
        return {
          get<Name extends keyof T & string>(arg: Name) {
            return setCookies.get(arg) as
              | ResponseCookie<Name, T[Name]>
              | undefined;
          },
          set(...args) {
            const [arg1, arg2, arg3] = args;
            if (typeof arg1 === "object") {
              setCookies.set(arg1.name, arg1);
            } else {
              setCookies.set(arg1, {
                name: arg1,
                value: arg2,
                ...arg3,
              });
            }
          },
          delete(name, options) {
            const exists = this.get(name);
            if (exists && exists.maxAge !== 0) {
              setCookies.delete(this.get(name));
            } else {
              setCookies.set(name, {
                ...options,
                name,
                value: "",
                maxAge: 0,
              });
            }
          },
        };
      },
    },
    client: input?.ctx ?? {},
    encode: (string, o) =>
      encode(string, { ...o, secret: o.secret ?? options.secret }),
    decode: (string, o) =>
      decode(string, { ...o, secret: o.secret ?? options.secret }),
  };

  const obj = router[route]?.[procedure] as QueryObject;
  let func = obj?.[action as "query"];

  if (!obj || (action && !func)) {
    console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
    console.log("\n\n");
    return {
      data: error({
        message: `API route not found: ${route} ${procedure} ${action}`,
      }),
      init: {
        headers: new Headers(),
        status: 404,
      },
    };
  }

  if (!func) {
    func = "query" in obj ? obj.query : (obj as MutationObject).mutation;
  }

  let result: void | Result<any>;

  const getErrorStatus = (err: Failure) => {
    if (err.status) return err.status;
    return context.response.status === 200 ? 500 : context.response.status;
  };

  try {
    result = await func.call({ context, method: request.method }, input?.query);
  } catch (err) {
    console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
    console.log("\n\n");

    if (isResult(err) && isError(err)) {
      return {
        data: err,
        init: {
          headers: new Headers(),
          status: getErrorStatus(err),
        },
      };
    }

    return {
      data: error({ message: "serverfejl", detail: err }),
      init: {
        headers: new Headers(),
        status: 500,
      },
    };
  }

  console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
  console.log("\n\n");

  if (request.method === "OPTIONS") {
    console.log("\n\n");
    return {
      init: {
        headers: context.response.headers,
        status: 200,
      },
    };
  }

  if (result && isError(result)) {
    context.response.status = getErrorStatus(result);
  }

  if (!context.response.headers.has("Set-Cookie")) {
    Array.from(setCookies.values()).forEach((el) => {
      const isDeleting = el.value === "" && el.maxAge === 0;
      const code = el.httpOnly ? (el.encrypt ? "e" : "s") : "c";
      const name = `sf.${code}.${el.name}`;
      const value =
        el.httpOnly && !isDeleting
          ? encode(el.value, {
              secret: options.secret,
              encrypt: el.encrypt,
            })
          : el.value;
      context.response.headers.append("Set-Cookie", serialize(name, value, el));
    });
  }

  return {
    data: result ?? success(null),
    init: {
      headers: context.response.headers,
      status: context.response.status,
    },
  };
}
