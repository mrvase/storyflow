import type { CookieParseOptions, CookieSerializeOptions } from "cookie";
import { parse, serialize } from "cookie";
import { decodeCookieValue, encodeCookieValue } from "./crypto-edge";

export interface CookieSignatureOptions {
  secrets?: string[];
}

export type CookieOptions = CookieParseOptions &
  CookieSerializeOptions &
  CookieSignatureOptions;

export interface Cookie {
  readonly name: string;
  readonly isSigned: boolean;
  readonly expires?: Date;
  parse(
    cookieHeader: string | null,
    options?: CookieParseOptions
  ): Promise<any>;
  serialize(value: any, options?: CookieSerializeOptions): Promise<string>;
}

export const createCookie = (
  name: string,
  cookieOptions: CookieOptions = {}
): Cookie => {
  let { secrets, ...options } = {
    secrets: [],
    path: "/",
    ...cookieOptions,
  };

  return {
    get name() {
      return name;
    },
    get isSigned() {
      return secrets.length > 0;
    },
    get expires() {
      // Max-Age takes precedence over Expires
      return typeof options.maxAge !== "undefined"
        ? new Date(Date.now() + options.maxAge * 1000)
        : options.expires;
    },
    async parse(cookieHeader, parseOptions) {
      if (!cookieHeader) return null;
      let cookies = parse(cookieHeader, { ...options, ...parseOptions });
      return name in cookies
        ? cookies[name] === ""
          ? ""
          : await decodeCookieValue(cookies[name], secrets)
        : null;
    },
    async serialize(value, serializeOptions) {
      return serialize(
        name,
        value === "" ? "" : await encodeCookieValue(value, secrets),
        {
          ...options,
          ...serializeOptions,
        }
      );
    },
  };
};

export const isCookie = (object: any): object is Cookie => {
  return (
    object != null &&
    typeof object.name === "string" &&
    typeof object.isSigned === "boolean" &&
    typeof object.parse === "function" &&
    typeof object.serialize === "function"
  );
};
