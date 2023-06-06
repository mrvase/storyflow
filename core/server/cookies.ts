import { CookieSerializeOptions, parse, serialize } from "cookie";
import { decode, encode } from "./crypto";
export type { CookieSerializeOptions } from "cookie";

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

export const getCookieFunction = (cookieHeader: string, secret?: string) => {
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

export const setCookiesFunction = (headers: Headers, secret?: string) => {
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
