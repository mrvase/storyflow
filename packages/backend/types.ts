export type StringType<T extends string> = string & { __type: T }; // could be [key in T]: any

export type DocumentId = StringType<"short-id">;
export type TemplateFieldId = StringType<"template-field-id">;
export type FieldId = StringType<"field-id">; // `${DocumentId}${TemplateFieldId}`

export type Parameter = { x: number; value?: PrimitiveValue };

// placeholders are meant to be replaced by a value when the computation is executed
export type Placeholder = Parameter | FieldImport | Fetcher;
export type FlatPlaceholder = Parameter | FlatFieldImport | Fetcher;

// symbols are also meant to be eliminated when the computation is executed,
// but unlike placeholders, they do not indicate a place for a value
// but define the execution of a function
// NOTICE! They are characterized by only one key-value pair
// if this changes, we need to change the symb.equals implementation
//

export type SharedSymbol =
  | { "(": true }
  | { ")": true }
  | { "[": true }
  | { "]": true }
  | { n: true };

export type EditorSymbol =
  | SharedSymbol
  | { _: Operator }
  | { ")": FunctionName }
  | { ",": true };

export type DBSymbol =
  | SharedSymbol
  | { "{": true }
  | { "}": true }
  | { "/": true }
  | { ")": Operator | FunctionName }
  | { p: TemplateFieldId };

type SharedSymbolKey = "(" | ")" | "[" | "]" | "n";
export type EditorSymbolKey = SharedSymbolKey | "_" | ",";
export type DBSymbolKey = SharedSymbolKey | "{" | "}" | "/" | "p";

export type EditorComputation = (Value | Placeholder | EditorSymbol)[];
export type Computation = (Value | Placeholder | DBSymbol)[];

// FlatComputations reside as the value in ComputationBlocks, and they are always
// the root of the computation.  Nested arrays only occur as a product of calculations,
// so they cannot be in the FlatComputation.
export type FlatComputation = (
  | Exclude<FlatValue, FlatValue[]>
  | FlatPlaceholder
  | DBSymbol
)[];

// These occur when we in the database compute the ComputationBlocks and add
// the "result" and "function" properties to the block. But this does not
// create a problem for us.
export type PossiblyNestedFlatComputation = (
  | FlatValue
  | FlatPlaceholder
  | DBSymbol
)[];

export type NonNestedComputation = (
  | Exclude<Value, Value[]>
  | Placeholder
  | DBSymbol
)[];

export type DocumentImport = { dref: DocumentId };

export type FlatFieldImport = {
  id: string;
  fref: FieldId;
  pick?: TemplateFieldId /* pick column */;
};

export type FieldImport = {
  id: string;
  fref: FieldId;
  args: { [key: number]: Computation } /* only used on client */;
  pick?: TemplateFieldId /* pick column */;
};

export type FlatComputationRecord = { [key: string]: FlatComputation };
export type ComputationRecord = { [key: string]: Computation };

export type ValueRecord<Key extends string = string> = Record<Key, Value[]>;

export type FlatLayoutElement = {
  id: string;
  type: string;
  props: Record<string, boolean>;
};

export type LayoutElement = {
  id: string;
  type: string;
  props: ComputationRecord;
  parent?: string;
};

export type FlatNestedDocument = {
  id: DocumentId;
  values?: string[];
  // not included in import because it is not used there,
  // but if it belongs to the doc, it lists the ids of the fields it contains
};

export type NestedDocument = {
  id: DocumentId;
  values: ComputationRecord;
  path?: string;
};

export type FlatFilter = {
  field: TemplateFieldId | "folder" | "";
  operation: "=" | "<" | ">" | ">=" | "<=" | "";
};

export type Filter = {
  field: TemplateFieldId | "folder" | "";
  operation: "=" | "<" | ">" | ">=" | "<=" | "";
  value: Computation;
};

export type FlatFetcher = {
  id: string;
  filters: FlatFilter[];
};

export type Fetcher = {
  id: string;
  filters: Filter[];
};

export type CustomToken = {
  name: string;
};

export type FileToken = {
  src: string;
};

export type ColorToken = {
  color: string;
};

export type Token = CustomToken | FileToken | ColorToken;

export type PrimitiveValue = string | number | boolean | Date;

export type FlatValue =
  | PrimitiveValue
  | FlatLayoutElement
  | FlatNestedDocument
  | DocumentImport
  | Token
  | FlatValue[];

export type Value =
  | PrimitiveValue
  | LayoutElement
  | NestedDocument
  | DocumentImport
  | Token
  | Value[];

export const operators = [
  "*",
  "+",
  "-",
  "/",
  "=",
  "<",
  ">",
  ">=",
  "<=",
  "&",
  "|",
] as const;

export type Operator = (typeof operators)[number];

export const functions = [
  "in",
  "concat",
  "sum",
  "filter",
  "slug",
  "url",
  "pick",
] as const;

export type FunctionName = (typeof functions)[number];

export type ComputationBlock = {
  id: FieldId;
  value: FlatComputation;
};

export type FieldType = "default" | "url" | "slug";

export type RestrictTo =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "color"
  | "image"
  | "video"
  | "children";

export type FieldConfig<T extends FieldType = FieldType> = {
  id: FieldId;
  label: string;
  type: T;
  template?: DocumentId;
  restrictTo?: RestrictTo;
};

export type TemplateRef = {
  template: DocumentId;
};

export type HeadingConfig = {
  text: string;
  level: number;
};

export type DocumentConfigItem =
  | TemplateRef
  | HeadingConfig
  | FieldConfig
  | FieldConfig[];

export type DocumentConfig = DocumentConfigItem[];

export type TemplateDocument = Omit<DBDocument, "version" | "folder">;

export interface DBDocument {
  id: DocumentId;
  folder: string;
  config: DocumentConfig;
  values: ValueRecord<TemplateFieldId>;
  compute: ComputationBlock[];
  label?: string;
  versions?: Record<TemplateFieldId | DocumentId, number>;
}

export type FolderChild =
  | {
      id: string;
      index: string;
      after: string | null;
    }
  | {
      remove: string;
    };

export interface DBFolder {
  id: string;
  type: "data" | "app" | "root" | "templates";
  label: string;
  template?: DocumentId;
  domains?: string[];
  children: FolderChild[];
  spaces?: Space[];
  versions?: Record<string, number>;
}

export type FolderSpace = {
  id: string;
  type: "folders";
  items: string[];
};

export type Space =
  | FolderSpace
  | {
      id: string;
      type: "documents";
      folder?: string;
    };

export interface Settings {
  domains: {
    id: string;
    configUrl: string;
  }[];
}

export type SearchableProps = Record<string, Record<string, boolean>>;
