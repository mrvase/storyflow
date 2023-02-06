export type StringType<T extends string> = string & { __type: T }; // could be [key in T]: any

export type DocumentId = StringType<"short-id">;
export type TemplateFieldId = StringType<"template-field-id">;
export type FieldId = StringType<"field-id">; // `${DocumentId}${TemplateFieldId}`

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
  props: string[];
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

export type PrimitiveValue = string | number | boolean | Date;

export type FlatValue = PrimitiveValue | FlatLayoutElement | FlatNestedDocument;

export type Value =
  | string
  | number
  | boolean
  | Date
  | LayoutElement
  | NestedDocument;

export type Parameter = [number, PrimitiveValue?];

export type Placeholder = Parameter | DocumentImport | FieldImport | Fetcher;
export type FlatPlaceholder =
  | Parameter
  | DocumentImport
  | FlatFieldImport
  | Fetcher;

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

export type TokenString = StringType<"token">;

export type Token = [TokenString];

export type SharedSymbol = ["("] | [")"] | ["n"] | Token;

export type EditorSymbol =
  | SharedSymbol
  | [Operator]
  | ["(", FunctionName]
  | [","];

export type DBSymbol =
  | SharedSymbol
  | ["{"]
  | ["}"]
  | [")", Operator | FunctionName]
  | ["p", TemplateFieldId];

export type EditorComputation = (Value | Placeholder | EditorSymbol)[];
export type Computation = (Value | Placeholder | DBSymbol)[];
export type FlatComputation = (FlatValue | FlatPlaceholder | DBSymbol)[];

export type ComputationBlock = {
  id: FieldId;
  value: FlatComputation;
};

export type FieldType = "default" | "url" | "slug";

export type FieldConfig<T extends FieldType = FieldType> = {
  id: FieldId;
  label: string;
  type: T;
  template?: DocumentId;
  restrictTo?: string;
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

export type PropConfig = {
  name: string;
  type: string;
  label: string;
  defaultValue?: any;
  searchable?: boolean;
};

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
  children: FolderChild[];
}

export interface Settings {
  domains: {
    id: string;
    configUrl: string;
  }[];
}
