import qs from "qs";
import { error, isError, success } from "./result";
import type {
  API,
  Context,
  MutationObject,
  QueryObject,
  RPCResponse,
  RequestCookie,
  ResponseCookie,
  RequestCookies,
} from "./types";
import type { RPCRequest } from "./types";
import { parse, serialize } from "cookie";

const encrypt = (value: any): string => {
  return btoa(JSON.stringify(value));
};

const decrypt = (value: string): unknown => {
  return JSON.parse(atob(value));
};

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
  router: T
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

  // sf.s.token
  const entries: [string, any][] = [];

  Object.entries(cookies).forEach(([prefixedName, string]) => {
    const [prefix, env, ...rest] = prefixedName.split(".");
    const name = rest.join(".");
    if (prefix === "sf" && ["s", "c"].includes(env) && name !== "") {
      entries.push([
        name,
        { name, value: env === "s" ? decrypt(string) : string },
      ]);
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
          delete(name) {
            const exists = this.get(name);
            if (exists) {
              setCookies.delete(this.get(name));
            } else {
              setCookies.set(name, {
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

  try {
    if (!func) {
      func = "query" in obj ? obj.query : (obj as MutationObject).mutation;
    }

    const result = await func.call(
      { context, method: request.method },
      input?.query
    );

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
      context.response.status =
        context.response.status === 200 ? 500 : context.response.status;
    }

    if (!context.response.headers.has("Set-Cookie")) {
      context.response.headers.set(
        "Set-Cookie",
        Array.from(setCookies.values())
          .map((el) => {
            const name = `sf.${el.httpOnly ? "s" : "c"}.${el.name}`;
            const value = el.httpOnly ? encrypt(el.value) : el.value;
            return serialize(name, value, el);
          })
          .join("; ")
      );
    }

    return {
      data: result ?? success(null),
      init: {
        headers: context.response.headers,
        status: context.response.status,
      },
    };
  } catch (err) {
    console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
    console.log("\n\n");

    console.log("ERROR");

    return {
      data: error({ message: "serverfejl", detail: err }),
      init: {
        headers: new Headers(),
        status: 500,
      },
    };
  }
}
