import { ZodType } from "zod";

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

export type SchemaInput = ZodType<any, any, any> | unknown;

export interface Context {
  req: Request;
  res: Response;
  client: Record<string, any>;
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