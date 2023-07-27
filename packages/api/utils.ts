export const modifyObject = <
  TInputKey extends string,
  TInputValue,
  TOutputKey extends string,
  TOutputValue
>(
  object: Record<TInputKey, TInputValue>,
  modifier: (
    object: [TInputKey, TInputValue]
  ) => [TOutputKey, TOutputValue] | undefined
): Record<TOutputKey, TOutputValue> => {
  return Object.fromEntries(
    Object.entries(object).reduce((a, [key, value]) => {
      const result = modifier([key as TInputKey, value as TInputValue]);
      if (result) {
        a.push(result);
      }
      return a;
    }, [] as [TOutputKey, TOutputValue][]) as any
  ) as any;
};

export const modifyValues = <
  TInputKey extends string,
  TInputValue,
  TOutputValue
>(
  object: Record<TInputKey, TInputValue>,
  modifier: (object: TInputValue) => TOutputValue
): Record<TInputKey, TOutputValue> => {
  return modifyObject(object, ([key, value]) => [key, modifier(value)]);
};

export const modifyKeys = <
  TInputKey extends string,
  TInputValue,
  TOutputKey extends string
>(
  object: Record<TInputKey, TInputValue>,
  modifier: (object: TInputKey) => TOutputKey
): Record<TOutputKey, TInputValue> => {
  return modifyObject(object, ([key, value]) => [modifier(key), value]);
};

export const promiseFromEntries = <
  Key extends string,
  Value extends Promise<unknown>
>(
  entries: [Key, Value][]
) => {
  return Promise.all(entries.map(([, value]) => value)).then((values) => {
    return Object.fromEntries(
      entries.map(([key], index) => [key, values[index]])
    ) as Record<Key, Awaited<Value>>;
  });
};
