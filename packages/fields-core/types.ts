import {
  DocumentId,
  FieldId,
  FunctionName,
  NestedDocumentId,
  Operator,
  PrimitiveValue,
  RawDocumentId,
  RawFieldId,
  Value,
  operators,
} from "@storyflow/shared/types";

type StringToSymbol<K> = K extends string
  ? {
      [P in K]: true;
    }
  : never;

type RecursivelyGenerateSymbolsFromArray<T extends readonly string[]> =
  T extends readonly [infer K, ...infer Rest]
    ?
        | StringToSymbol<K>
        | RecursivelyGenerateSymbolsFromArray<
            Rest extends readonly string[] ? Rest : []
          >
    : T extends [infer K]
    ? StringToSymbol<K>
    : never;

export type OperatorSymbol = RecursivelyGenerateSymbolsFromArray<
  typeof operators
>;

export type Sorting = `${"-" | "+"}${RawFieldId}`;

export type FunctionSymbol =
  | { in: true }
  | { concat: true }
  | { sum: true }
  | { filter: true }
  | { slug: true }
  | { url: true }
  | { root: true }
  | { merge: true }
  | { template: RawDocumentId }
  | { select: RawFieldId }
  | { loop: RawDocumentId }
  | { fetch: [limit: number, ...sortings: Sorting[]] };

type KeysOfUnion<T> = T extends T ? keyof T : never;
type ValuesOfUnion<T> = T extends T ? T[keyof T] : never;

export type FunctionData = ValuesOfUnion<FunctionSymbol>;
export type GetFunctionData<T extends FunctionName> = Extract<
  FunctionSymbol,
  { [P in T]: any }
>[T];

/* TEST */

type Assert<T extends true> = T;
type Keys = KeysOfUnion<FunctionSymbol>;
type AssertFunctionEquality = Assert<
  Keys extends FunctionName ? (FunctionName extends Keys ? true : false) : false
>;

/* SYNTAX TREE */

export type LineBreak = { n: true };
export type Parameter = { x: number; value?: PrimitiveValue };

export type NestedField = {
  id: NestedDocumentId;
  field: FieldId;
  inline?: true;
};

export type NestedCreator = {
  id: NestedDocumentId;
  text: string;
  inline?: true;
};

export type WithSyntaxError = {
  error: "," | ")" | "missing";
};

export type SyntaxNode<
  WithExtraChildren extends WithSyntaxError | never = WithSyntaxError | never
> = {
  type: Operator | FunctionName | "array" | null;
  children: (
    | SyntaxNode<WithExtraChildren>
    | Parameter
    | NestedField
    | LineBreak
    | Value
    | any[] // like streams, they are never nested, but this allows us to have ValueArray as a child as well.
    | WithExtraChildren
  )[];
  data?: any;
  open?: true;
};

export type SyntaxTree<
  WithExtraChildren extends WithSyntaxError | never = WithSyntaxError | never
> = SyntaxNode<WithExtraChildren>;

export type SyntaxTreeRecord = Record<FieldId, SyntaxTree<WithSyntaxError>>; // { [key: FieldId]: SyntaxTree<WithSyntaxError> };

/* FIELDS */

export type FieldTransform = {
  type: FunctionName;
  data?: SyntaxNode["data"];
};

export type FieldUI = "url";

export type FieldType2 =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "color"
  | "image"
  | "video"
  | "children"
  | "data";

export type FieldConfig = {
  id: FieldId;
  label: string;
  ui?: FieldUI;
  type2?: FieldType2;
  template?: DocumentId;
};

export type DefaultFieldConfig = {
  id: FieldId;
  label: string;
  ui?: FieldUI;
  type2?: FieldType2;
  initialValue?: {
    transforms?: FieldTransform[];
    children?: SyntaxTree["children"];
  };
};

/* streams */

export type StreamEntity<StreamSymbol> =
  | StreamSymbol
  | NestedField
  | LineBreak
  | Value
  | any[] // in principle never nested, but allows us to consider ValueArray as a subset of a stream.
  | Parameter;
