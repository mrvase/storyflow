type WithVariableAndModifier<
  T extends string,
  U extends string
> = `{{${T}:${U}}}${string}`;

type WithVariable<T extends string> = `{{${T}}}${string}`;

type WithVariableInBetween<T extends string> = `${T}}}${string}`;

type Prettify<T> = { [Key in keyof T]: T[Key] } & {};

type ModifierTypes = Record<string, string | number>;

type GetVariablesImpl<
  Acc extends string,
  Object extends { [key: string]: string | number },
  Test extends string,
  M extends ModifierTypes
> = Test extends `${Acc}${WithVariableAndModifier<infer V, infer T>}`
  ? V extends WithVariableInBetween<infer VCorrected>
    ? GetVariablesImpl<
        `${Acc}${WithVariable<VCorrected>}`,
        Object & { [key in VCorrected]: string | number },
        Test,
        M
      >
    : GetVariablesImpl<
        `${Acc}${WithVariableAndModifier<V, T>}`,
        Object & { [key in V]: M[T] },
        Test,
        M
      >
  : Test extends `${Acc}${WithVariable<infer V>}`
  ? GetVariablesImpl<
      `${Acc}${WithVariable<V>}`,
      Object & { [key in V]: string | number },
      Test,
      M
    >
  : Test extends `${string}(${string}|${string})${string}`
  ? Prettify<Object & { count?: number }>
  : Prettify<Object>;

export type Modifiers = Record<string, (value: any) => string | number>;

type CreateModifierTypes<T extends Modifiers> = {
  [Key in keyof T]: ModifierToType<Key, T>;
};

type ModifierToType<T extends keyof M, M extends Modifiers> = T extends keyof M
  ? Parameters<M[T]>[0]
  : never;

// typescript intellisense enters infinite loading state if any is passed to GetVariables without handling it
type IsStringAndNotAny<T> = (T extends string ? true : false) extends true
  ? true
  : false;

export type GetVariables<
  T extends string,
  M extends Modifiers
> = IsStringAndNotAny<T> extends true
  ? GetVariablesImpl<string, {}, T, CreateModifierTypes<M>>
  : {};

export type Translation = Record<string, Record<string, string>>;

type Optionalize<T extends [object]> = keyof T[0] extends never
  ? []
  : keyof T[0] extends "count"
  ? [variables?: { count?: number }]
  : T;

export type TranslationFunction<T extends Translation, M extends Modifiers> = {
  [Namespace in keyof T]: {
    [Key in keyof T[Namespace]]: (
      ...arr: Optionalize<[variables: GetVariables<T[Namespace][Key], M>]>
    ) => string;
  };
};
