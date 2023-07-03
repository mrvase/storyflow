import { extendPath } from "./extendPath";

type ZType = { parse: (obj: unknown, path?: string) => any };

type Primitive = "string" | "number" | "boolean" | ZType;

type PrimitiveToType<TPrimitive extends Primitive> = TPrimitive extends
  | "string"
  | "number"
  | "boolean"
  ? {
      string: string;
      number: number;
      boolean: boolean;
    }[TPrimitive]
  : TPrimitive extends ZType
  ? ReturnType<TPrimitive["parse"]>
  : never;

const isZ = (obj: unknown): obj is ZType =>
  Boolean(obj && typeof obj === "object" && "parse" in obj);

const parsePrimitive = <TValue, TType extends Primitive>(
  value: TValue,
  type: TType,
  path: string
) => {
  if (isZ(type)) {
    return type.parse(value, path);
  } else if (typeof value !== type) {
    throw new Error(
      `[path ${path}]: Expected \`${value}\` to be \`${type}\` but got \`${typeof value}\``
    );
  }
  return value;
};

type PrimitiveToTypeArray<
  T extends readonly Primitive[],
  Result extends any[] = []
> = T extends readonly []
  ? Result
  : T extends readonly [infer Head, ...infer Tail]
  ? Head extends Primitive
    ? Tail extends readonly Primitive[]
      ? PrimitiveToTypeArray<Tail, [...Result, PrimitiveToType<Head>]>
      : never
    : never
  : never;

export const z = {
  object: <TObject extends { [key: string]: Primitive }>(schema: TObject) => ({
    parse: (
      obj: unknown,
      path: string = ""
    ): { [Key in keyof TObject]: PrimitiveToType<TObject[Key]> } => {
      if (!obj || typeof obj !== "object") {
        throw new Error(
          `[path ${path}] Expected \`${obj}\` to be \`array\` but got \`${typeof obj}\``
        );
      }
      Object.entries(schema).forEach(([key, type]) => {
        parsePrimitive((obj as any)[key], type, extendPath(path, key));
      });
      return obj as any;
    },
  }),
  array: <TArray extends Primitive>(schema: TArray) => ({
    parse: (obj: unknown, path: string = ""): PrimitiveToType<TArray>[] => {
      if (!obj || !Array.isArray(obj)) {
        throw new Error(
          `[path ${path}]: Expected \`${obj}\` to be \`array\` but got \`${typeof obj}\``
        );
      }
      obj.every((el, index) => {
        parsePrimitive(el, schema, extendPath(path, `${index}`));
      });
      return obj as any;
    },
  }),
  tuple: <const TArray extends readonly Primitive[]>(schema: TArray) => ({
    parse: (obj: unknown, path: string = ""): PrimitiveToTypeArray<TArray> => {
      if (!obj || !Array.isArray(obj)) {
        throw new Error(
          `[path ${path}]: Expected \`${obj}\` to be \`array\` but got \`${typeof obj}\``
        );
      }
      obj.every((el, index) => {
        parsePrimitive(el, schema[index], extendPath(path, `${index}`));
      });
      return obj as any;
    },
  }),
};
