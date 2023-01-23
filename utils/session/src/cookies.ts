import type { CookieParseOptions, CookieSerializeOptions } from "cookie";
import { parse, serialize } from "cookie";

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
  cookieOptions: CookieOptions = {},
  {
    sign,
    unsign,
  }: {
    sign: (val: string, secret: string) => Promise<string>;
    unsign: (val: string, secret: string) => Promise<string | false>;
  }
): Cookie => {
  function encodeData(value: any): string {
    return btoa(JSON.stringify(value)); // btoa(JSON.stringify(value));
  }

  function decodeData(value: string): any {
    try {
      return JSON.parse(atob(value)); // atob(value)
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  async function encodeCookieValue(
    value: any,
    secrets: string[]
  ): Promise<string> {
    let encoded = encodeData(value);

    if (secrets.length > 0) {
      encoded = await sign(encoded, secrets[0]);
    }

    return encoded;
  }

  async function decodeCookieValue(
    value: string,
    secrets: string[]
  ): Promise<any> {
    if (secrets.length > 0) {
      for (let secret of secrets) {
        let unsignedValue = await unsign(value, secret);
        if (unsignedValue !== false) {
          const decoded = decodeData(unsignedValue);
          console.log("DECODED", unsignedValue, decoded);
          return decoded;
        }
      }

      return null;
    }

    return decodeData(value);
  }

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
