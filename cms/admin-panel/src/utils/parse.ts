import { extendPath } from "./extendPath";

type ZType = { parse: (obj: unknown, path?: string) => void };
type Primitive = "string" | "number" | "boolean" | ZType;

const isZ = (obj: unknown): obj is ZType =>
  Boolean(obj && typeof obj === "object" && "parse" in obj);

const parsePrimitive = (value: unknown, type: Primitive, path: string) => {
  if (isZ(type)) {
    type.parse(value, path);
  } else if (typeof value !== type) {
    throw new Error(
      `[path ${path}]: Expected \`${value}\` to be \`${type}\` but got \`${typeof value}\``
    );
  }
};

export const z = {
  object: (schema: Record<string, Primitive>) => ({
    parse: (obj: unknown, path: string = "") => {
      if (!obj || typeof obj !== "object") {
        throw new Error(
          `[path ${path}] Expected \`${obj}\` to be \`array\` but got \`${typeof obj}\``
        );
      }
      Object.entries(schema).forEach(([key, type]) => {
        parsePrimitive((obj as any)[key], type, extendPath(path, key));
      });
      return obj;
    },
  }),
  array: (schema: Primitive) => ({
    parse: (obj: unknown, path: string = "") => {
      if (!obj || !Array.isArray(obj)) {
        throw new Error(
          `[path ${path}]: Expected \`${obj}\` to be \`array\` but got \`${typeof obj}\``
        );
      }
      obj.every((el, index) => {
        parsePrimitive(el, schema, extendPath(path, `${index}`));
      });
      return obj;
    },
  }),
};
