import { NextRequest } from "next/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { CreateContext, Router } from "@nanorpc/server";
import { CookieSerializeOptions, parse, serialize } from "cookie";
import { decode, encode } from "./rpc/crypto";

const cryptoCtx = (secret?: string) => ({
  encode: (string: any, o: { secret?: string; encrypt?: boolean }) =>
    encode(string, { ...o, secret: o.secret ?? secret }),
  decode: (string: any, o: { secret?: string; decrypt?: boolean }) =>
    decode(string, { ...o, secret: o.secret ?? secret }),
});

type ResponseCookie<Name extends string = string, Value = any> = Omit<
  CookieSerializeOptions,
  "encode"
> & {
  name: Name;
  value: Value;
  encrypt?: boolean;
};

type RequestCookie<Name extends string = string, Value = any> = {
  name: Name;
  value: Value;
};

type RequestCookies<T extends Record<string, any> = Record<string, any>> = {
  get size(): number;
  get<Name extends keyof T>(
    name: Name
  ): (Name extends string ? RequestCookie<Name, T[Name]> : never) | undefined;
  has(name: string): boolean;
};

type ResponseCookies<T extends Record<string, any> = Record<string, any>> = {
  set<Name extends keyof T & string>(
    ...args:
      | [
          key: Name,
          value: T[Name],
          cookie?: Partial<ResponseCookie<Name, T[Name]>>
        ]
      | [options: ResponseCookie<Name, T[Name]>]
  ): void;
  delete(name: string, options: Partial<ResponseCookie>): void;
};

const getCookieFunction = (cookieHeader: string, secret?: string) => {
  const cookies = parse(cookieHeader);

  const entries: [string, any][] = [];

  Object.entries(cookies).forEach(([prefixedName, string]) => {
    const [prefix, env, ...rest] = prefixedName.split(".");
    const name = rest.join(".");
    if (
      secret &&
      prefix === "sf" &&
      ["e", "s", "c"].includes(env) &&
      name !== ""
    ) {
      let value: unknown = string;
      if (env !== "c") {
        value = decode(string, {
          secret,
          decrypt: env === "e",
        });
        if (!value) return;
      }
      entries.push([name, { name, value }]);
    }
  });

  return <T extends Record<string, any>>() => {
    return new Map<string, RequestCookie>(entries) as RequestCookies<T>;
  };
};

const setCookiesFunction = (headers: Headers, secret?: string) => {
  const setCookie = (el: ResponseCookie) => {
    const isDeleting = el.value === "" && el.maxAge === 0;
    const code = el.httpOnly ? (el.encrypt ? "e" : "s") : "c";
    const name = `sf.${code}.${el.name}`;
    const value =
      el.httpOnly && !isDeleting
        ? encode(el.value, {
            secret,
            encrypt: el.encrypt,
          })
        : el.value;
    const string = serialize(name, value, el);
    headers.append("Set-Cookie", string);
  };

  return <T extends Record<string, any> = Record<string, any>>() => {
    const setCookies = new Map<string, ResponseCookie>();
    const obj: ResponseCookies<T> = {
      set(...args) {
        const [arg1, arg2, arg3] = args;
        if (typeof arg1 === "object") {
          setCookie(arg1);
        } else {
          setCookie({
            name: arg1,
            value: arg2,
            ...arg3,
          });
        }
      },
      delete(name, options) {
        const exists = setCookies.get(name);
        if (exists && exists.maxAge !== 0) {
        } else {
          setCookie({
            ...options,
            name,
            value: "",
            maxAge: 0,
          });
        }
      },
    };
    return obj;
  };
};

export const createAPIRouteContext = (options: { secret?: string } = {}) =>
  (({ request, response }) => {
    const req = {
      url: request.url,
      method: request.method,
      headers: new Headers(
        Object.entries(request.headers).filter(
          // misses set-cookie which can be an array
          // but this is not used on request headers.
          (el): el is [string, string] => typeof el[1] === "string"
        )
      ),
      cookies: getCookieFunction(request.headers.cookie ?? "", options.secret),
    };

    const responseHeaders = new Headers();

    const res = {
      headers: responseHeaders,
      cookies: setCookiesFunction(responseHeaders, options.secret),
      commit: () => {
        const cookies: string[] = [];
        responseHeaders.forEach((value, key) => {
          if (key.toLowerCase() === "set-cookie") {
            cookies.push(value);
          } else {
            response.setHeader(key, value);
          }
        });

        if (cookies.length) {
          response.setHeader(
            "Set-Cookie",
            cookies.map((el) => el.split(/,\s?/g)).flat(1)
          );
        }
      },
    };

    return {
      req,
      res,
      ...cryptoCtx(options.secret),
    };
  }) satisfies CreateContext<NextApiRequest, NextApiResponse>;

export const createRouteHandlerContext = (options: { secret?: string } = {}) =>
  (({ request, response }) => {
    const req = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      cookies: getCookieFunction(
        request.headers.get("cookie") ?? "",
        options.secret
      ),
    };

    const responseHeaders = response.headers;

    const res = {
      headers: responseHeaders,
      cookies: setCookiesFunction(responseHeaders, options.secret),
      commit: () => {},
    };

    return {
      req,
      res,
      ...cryptoCtx(options.secret),
    };
  }) satisfies CreateContext<NextRequest, Response>;

export type Context = ReturnType<typeof createAPIRouteContext>;

/*
export const createRouteHandler = <T extends API>(
  router: T,
  options: {
    route?: string;
    procedure?: string;
    secret?: string;
  } = {}
) => {
  const createEndpoint =
    (method: "GET" | "POST" | "OPTIONS") =>
    async (req: NextRequest, context: { params: Record<string, string> }) => {
      const { route, procedure } = context?.params ?? {};

      let body;

      if (method === "POST") {
        try {
          body = await req.json();
        } catch (err) {}
      }

      const request: RPCRequest & { body?: any } = {
        method,
        url: req.url,
        headers: req.headers,
        route: options.route ?? route,
        procedure: options.procedure ?? procedure,
        body,
      };

      const {
        init: { redirect, ...init },
        data,
      } = await handleRequest(request, router, options);

      if (typeof redirect === "string") {
        return NextResponse.redirect(redirect, init);
      }

      if (!data) {
        return new Response(null, init);
      }

      return NextResponse.json(data, init);
    };

  return {
    GET: createEndpoint("GET"),
    POST: createEndpoint("POST"),
    OPTIONS: createEndpoint("OPTIONS"),
  };
};
*/
