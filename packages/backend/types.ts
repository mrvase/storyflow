declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & { [brand]: TBrand };

export type RawDocumentId = Brand<string, "raw-document-id">;
export type RawFieldId = Brand<string, "raw-field-id">;
export type DocumentId = Brand<string, "document-id">;
export type NestedDocumentId = Brand<string, "nested-document-id">;
export type FieldId = Brand<string, "field-id">;
export type RawFolderId = Brand<string, "raw-folder-id">;
export type FolderId = Brand<string, "folder-id">;
export type SpaceId = Brand<string, "space-id">;

export type BrandedObjectId<BrandedId> = {
  id: unknown;
  toHexString(): string;
} & {
  [brand]?: BrandedId extends Brand<string, infer TBrand> ? TBrand : never;
};

// symbols are also meant to be eliminated when the computation is executed,
// but unlike placeholders, they do not indicate a place for a value
// but define the execution of a function
// NOTICE! They are characterized by only one key-value pair
// if this changes, we need to change the symb.equals implementation

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
  | { p: RawFieldId };

type SharedSymbolKey = "(" | ")" | "[" | "]" | "n";
export type EditorSymbolKey = SharedSymbolKey | "_" | ",";
export type DBSymbolKey = SharedSymbolKey | "{" | "}" | "/" | "p";

export type ImportRecord = { [key: RawFieldId]: boolean };

export type NestedField = {
  id: NestedDocumentId;
  field: FieldId;
  imports?: ImportRecord;
  pick?: RawFieldId;
};

export type NestedElement = {
  id: NestedDocumentId;
  element: string;
  imports?: ImportRecord;
  parent?: string;
};

export type NestedFolder = {
  id: NestedDocumentId;
  folder: FolderId;
  imports?: ImportRecord;
};

export type NestedDocument = {
  id: DocumentId | NestedDocumentId;
  path?: string;
};

export type CustomToken = {
  name: string;
};

export type ContextToken = {
  ctx: string;
};

export type FileToken = {
  src: string;
};

export type ColorToken = {
  color: string;
};

export type Token = CustomToken | ContextToken | FileToken | ColorToken;

export type PrimitiveValue = string | number | boolean | Date;

export type Parameter = { x: number; value?: PrimitiveValue };

// placeholders are meant to be replaced by a value when the computation is executed
export type Placeholder = Parameter | NestedField;
export type Value =
  | PrimitiveValue
  | NestedElement
  | NestedDocument
  | NestedFolder
  | Token
  | Value[];
// Nested arrays only occur as a product of calculations.
export type Computation = (Exclude<Value, Value[]> | Placeholder | DBSymbol)[];

export type WithBrandedObjectId<T> = T extends {
  id: NestedDocumentId;
  field: FieldId;
}
  ? Omit<T, "id" | "field"> & {
      id: BrandedObjectId<NestedDocumentId>;
      field: BrandedObjectId<FieldId>;
    }
  : T extends { id: NestedDocumentId; folder: FolderId }
  ? Omit<T, "id" | "folder"> & {
      id: BrandedObjectId<NestedDocumentId>;
      folder: BrandedObjectId<FolderId>;
    }
  : T extends { id: DocumentId | NestedDocumentId }
  ? Omit<T, "id"> & { id: BrandedObjectId<DocumentId | NestedDocumentId> }
  : T;

export type DBValue =
  | PrimitiveValue
  | WithBrandedObjectId<NestedElement>
  | WithBrandedObjectId<NestedDocument>
  | WithBrandedObjectId<NestedFolder>
  | Token
  | DBValue[];
export type DBPlaceholder = Parameter | WithBrandedObjectId<NestedField>;
export type DBComputation = (
  | Exclude<DBValue, DBValue[]>
  | DBPlaceholder
  | DBSymbol
)[];

export type EditorComputation = (
  | Exclude<Value, Value[]>
  | Placeholder
  | EditorSymbol
)[];

// These occur when we in the database compute the ComputationBlocks and add
// the "result" and "function" properties to the block.
export type PossiblyNestedComputation = (Value | Placeholder | DBSymbol)[];
export type PossiblyNestedDBComputation = (
  | DBValue
  | DBPlaceholder
  | DBSymbol
)[];

export type ComputationRecord = { [key: FieldId]: Computation };

export type DBValueRecord = Record<RawFieldId, DBValue[]>;

export type ComputationBlock = {
  id: BrandedObjectId<FieldId>;
  value: DBComputation;
};

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

export interface DBDocumentRaw {
  _id: BrandedObjectId<DocumentId>;
  folder: BrandedObjectId<FolderId>;
  config: DocumentConfig;
  label?: string;
  versions?: Record<"" | RawFieldId, number>;
  /* compute */
  ids: BrandedObjectId<NestedDocumentId>[];
  cached: Value[][];
  compute: ComputationBlock[];
  values: DBValueRecord;
  /* */
}

export interface DBDocument {
  _id: DocumentId;
  folder: FolderId;
  config: DocumentConfig;
  record: ComputationRecord;
  // values: ValueRecord;
  label?: string;
  versions?: Record<"" | RawFieldId, number>;
}

export type FolderSpace = {
  id: SpaceId;
  type: "folders";
  items: string[];
};

export type Space =
  | FolderSpace
  | {
      id: SpaceId;
      type: "documents";
      folder?: FolderId;
    };

export interface DBFolderRaw {
  _id: BrandedObjectId<FolderId>;
  type: "data" | "app";
  label: string;
  spaces: Space[];
  template?: BrandedObjectId<DocumentId>;
  domains?: string[];
  versions?: Record<"" | SpaceId, number>;
}

export interface DBFolder {
  _id: FolderId;
  type: "data" | "app";
  label: string;
  spaces: Space[];
  template?: DocumentId;
  domains?: string[];
  versions?: Record<"" | SpaceId, number>;
}

export interface Settings {
  domains: {
    id: string;
    configUrl: string;
  }[];
}

export type SearchableProps = Record<string, Record<string, boolean>>;
