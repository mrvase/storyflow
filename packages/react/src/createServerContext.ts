import { ContextProvider, context } from "@storyflow/shared/types";

export function createServerContext<Value>(): ContextProvider<
  Value | undefined
>;
export function createServerContext<Value>(
  defaultValue: Value
): ContextProvider<Value>;
export function createServerContext<Value>(
  defaultValue?: Value
): ContextProvider<Value | undefined> {
  const id = Symbol("server-context");

  return Object.assign(
    (value: Value) => ({
      value,
      [context]: id,
    }),
    { defaultValue, [context]: id }
  ) as ContextProvider<Value | undefined>;
}
