import { ZodType } from "zod";
import { parse } from "cookie";
import type { CookieSerializeOptions } from "cookie";

export * from "./types-shared";

/*
export type DefaultRequest = {
  params?: object;
  query?: object;
  method?: string;
  url?: string;
  headers: Record<string, any> | { get(name: string): string | null };
};

export type DefaultResponse = {
  status: (code: number) => DefaultResponse;
  json: (body: any) => void;
  end: () => DefaultResponse;
  writableEnded: boolean;
};

type ExtendableTypes = "Request" | "Response";

export interface CustomTypes {
  [key: string]: unknown;
}

type ExtendedType<K extends ExtendableTypes, B> = unknown extends CustomTypes[K]
  ? B
  : CustomTypes[K] extends B
  ? CustomTypes[K]
  : never;

export type Request = ExtendedType<"Request", DefaultRequest>;
export type Response = ExtendedType<"Response", DefaultResponse>;
*/

export type ResponseCookie<Name extends string = string, Value = any> = Omit<
  CookieSerializeOptions,
  "encode"
> & {
  name: Name;
  value: Value;
  encrypt?: boolean;
};

export type RequestCookie<Name extends string = string, Value = any> = {
  name: Name;
  value: Value;
};

export type RequestCookies<
  T extends Record<string, any> = Record<string, any>
> = {
  get size(): number;
  get<Name extends keyof T>(
    name: Name
  ): (Name extends string ? RequestCookie<Name, T[Name]> : never) | undefined;
  has(name: string): boolean;
};

export type ResponseCookies<
  T extends Record<string, any> = Record<string, any>
> = {
  get<Name extends keyof T & string>(
    name: Name
  ): ResponseCookie<Name, T[Name]> | undefined;
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

export type RPCRequest = {
  method: "GET" | "POST" | "OPTIONS";
  url: string;
  headers: Headers;
  route: string;
  procedure: string;
};

export type RPCResponse = {
  headers: Headers;
  status: number;
  redirect?: string;
};

export type SchemaInput = ZodType<any, any, any> | unknown;

export interface Context {
  request: RPCRequest & {
    cookies<
      T extends Record<string, any> = Record<string, any>
    >(): RequestCookies<T>;
  };
  response: RPCResponse & {
    cookies<
      T extends Record<string, any> = Record<string, any>
    >(): ResponseCookies<T>;
  };
  client: Record<string, any>;
  encode: (
    value: any,
    options: { secret?: string; encrypt?: boolean }
  ) => string;
  decode: <T>(
    value: string,
    options: { secret?: string; decrypt?: boolean }
  ) => T | null;
}

type MiddlewareFunc = (ctx: any) => any;

type Use = <Funcs extends MiddlewareFunc[]>(
  ...fns: Funcs
) => Promise<MergeReturnTypes<Funcs>>;

type MergeReturnTypes<
  Funcs extends MiddlewareFunc[],
  Result = {}
> = Funcs extends [(ctx: any) => Promise<infer R1>]
  ? R1 extends { [key: string]: any }
    ? Result & { [K in keyof R1]: R1[K] }
    : Result
  : Funcs extends [(ctx: any) => Promise<infer R2>, ...infer Tail]
  ? Tail extends MiddlewareFunc[]
    ? MergeReturnTypes<Tail, R2>
    : Result
  : Result;

export interface MiddlewareContext extends Context {
  use: Use;
}
