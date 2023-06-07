import { NextRequest } from "next/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { CreateContext } from "@nanorpc/server";
import { decode, encode } from "./crypto";
import { getCookieFunction, setCookiesFunction } from "./cookies";
import { Context } from "./rpc/procedure";

export const createAPIRouteContext = (options: { secret?: string } = {}) =>
  (({ request, response }) => {
    const req = {
      url: request.url!,
      method: request.method as "GET" | "POST" | "OPTIONS",
      headers: new Headers(
        Object.entries(request.headers).filter(
          // misses set-cookie which can be an array
          // but this is not used on request headers.
          (el): el is [string, string] => typeof el[1] === "string"
        )
      ),
      cookies: getCookieFunction(request.headers.cookie ?? "", options.secret),
    };

    const headers = {
      append(name: string, value: string) {
        if (name.toLowerCase() === "set-cookie") {
          const cookies = response.getHeader("set-cookie");
          const cookiesArray = Array.isArray(cookies)
            ? cookies
            : typeof cookies === "string"
            ? [cookies]
            : [];
          response.setHeader("set-cookie", [...cookiesArray, value]);
        } else {
          response.setHeader(name, value);
        }
      },
      delete(name: string) {
        response.removeHeader(name);
      },
      get(name: string) {
        const result = response.getHeader(name);
        if (Array.isArray(result)) return result.join(", ");
        return `${result}` ?? null;
      },
      has(name: string) {
        return response.hasHeader(name);
      },
      set(name: string, value: string) {
        response.setHeader(name, value);
      },
      forEach(callback: (value: string, key: string, parent: Headers) => void) {
        Object.entries(response.getHeaders()).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((el) => callback(el, key, headers));
          } else {
            callback(`${value}`, key, headers);
          }
        });
      },
    } as Headers;

    const res = {
      headers,
      cookies: setCookiesFunction(headers, options.secret),
    };

    return {
      req,
      res,
      encode: (v, o) =>
        encode(v, { ...o, secret: o?.secret ?? options.secret }),
      decode: (v, o) =>
        decode(v, { ...o, secret: o?.secret ?? options.secret }),
    } satisfies Context;
  }) satisfies CreateContext<NextApiRequest, NextApiResponse>;

export const createRouteHandlerContext = (options: { secret?: string } = {}) =>
  (({ request, response }) => {
    const req = {
      url: request.url!,
      method: request.method as "GET" | "POST" | "OPTIONS",
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
    };

    return {
      req,
      res,
      encode: (v, o) =>
        encode(v, { ...o, secret: o?.secret ?? options.secret }),
      decode: (v, o) =>
        decode(v, { ...o, secret: o?.secret ?? options.secret }),
    } satisfies Context;
  }) satisfies CreateContext<NextRequest, Response>;
