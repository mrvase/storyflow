import { createProcedure } from "@nanorpc/server";
import type {} from "zod";
import { getCookieFunction, setCookiesFunction } from "../cookies";
import { decode, encode } from "../crypto";

export type Context = {
  req: {
    url: string;
    method: "GET" | "POST" | "OPTIONS";
    headers: Headers;
    cookies: ReturnType<typeof getCookieFunction>;
  };
  res: {
    headers: Headers;
    cookies: ReturnType<typeof setCookiesFunction>;
  };
  encode: typeof encode;
  decode: typeof decode;
};

export const procedure = createProcedure<Context>();
