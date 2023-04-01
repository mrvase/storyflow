/*
User input -> TokenStream
TokenStream -> SyntaxTree
SyntaxTree -> SyntaxStream
SyntaxStream -> SyntaxTree
SyntaxTree -> ValueArray
SyntaxStream -> ValueArray
SyntaxTree -> TokenStream
SyntaxTree -> RenderTree


User input --> Token Stream
                 <-[eq]->
        SyntaxTree<WithSyntaxError>
          <-[eq]->      --[ss]->
    SyntaxStream --[ss]-> ValueArray --> RenderTree

*/

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

export type DBId<BrandedId> = {
  id: unknown;
  toHexString(): string;
} & {
  [brand]?: BrandedId extends Brand<string, infer TBrand> ? TBrand : never;
};

export type HasDBId<T> = T extends {
  id: NestedDocumentId;
  field: FieldId;
}
  ? Omit<T, "id" | "field"> & {
      id: DBId<NestedDocumentId>;
      field: DBId<FieldId>;
    }
  : T extends { id: NestedDocumentId; folder: FolderId }
  ? Omit<T, "id" | "folder"> & {
      id: DBId<NestedDocumentId>;
      folder: DBId<FolderId>;
    }
  : T extends { id: DocumentId | NestedDocumentId }
  ? Omit<T, "id"> & { id: DBId<DocumentId | NestedDocumentId> }
  : T;

export type HasSelect<T> = T extends {
  id: NestedDocumentId | DocumentId;
  field: FieldId;
}
  ? T & {
      select?: RawFieldId;
    }
  : T;

/*
 * SHARED TOKENS
 */

export type PrimitiveValue = string | number | boolean | Date;

export type NestedField = {
  id: NestedDocumentId;
  field: FieldId;
  inline?: true;
};

export type NestedElement = {
  id: NestedDocumentId;
  element: string;
  // props: Record<RawFieldId, true>; // searchable props
  inline?: true;
};

export type NestedFolder = {
  id: NestedDocumentId;
  folder: FolderId;
  inline?: true;
};

export type NestedDocument = {
  id: DocumentId | NestedDocumentId;
  inline?: true;
};

export type NestedCreator = {
  id: NestedDocumentId;
  text: string;
  inline?: true;
};

export type NestedEntity =
  | NestedElement
  | NestedFolder
  | NestedDocument
  | NestedCreator;

export type InputToken = {
  input: string;
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

export type CustomToken = {
  name: string;
};

export type Token = CustomToken | ContextToken | FileToken | ColorToken;

export type LineBreak = { n: true };
export type Parameter = { x: number; value?: PrimitiveValue };

/**
 * VALUE ARRAY
 */

export type Value = PrimitiveValue | Token | NestedEntity;

export type Nested<T> = T | Nested<T>[];

export type ValueArray = Nested<Value>[];

/**
 * STREAM
 */

type StreamEntity<StreamSymbol> =
  | StreamSymbol
  | NestedField
  | LineBreak
  | Value
  | any[] // in principle never nested, but allows us to consider ValueArray as a subset of a stream.
  | Parameter;

/**
 * TOKEN STREAM
 */

export type TokenStreamSymbol =
  | { "(": true }
  | { ")": true }
  | { "[": true }
  | { "]": true }
  | { ",": true }
  | { _: Operator }
  | { ")": FunctionName }
  | { ")": "sortlimit"; l: number; s?: SortSpec };

export type TokenStream = HasSelect<StreamEntity<TokenStreamSymbol>>[];

/**
 * SYNTAX TREE
 */

export type WithSyntaxError = {
  error: "," | ")" | "missing";
};

export type SyntaxNode<
  WithExtraChildren extends WithSyntaxError | never = WithSyntaxError | never
> = {
  type: Operator | FunctionName | "merge" | "array" | "root" | null;
  children: (
    | SyntaxNode<WithExtraChildren>
    | Parameter
    | NestedField
    | LineBreak
    | Value
    | any[] // like streams, they are never nested, but this allows us to have ValueArray as a child as well.
    | WithExtraChildren
  )[];
  data?: Record<string, any>;
  open?: true;
};

export type SyntaxTree<
  WithExtraChildren extends WithSyntaxError | never = WithSyntaxError | never
> = SyntaxNode<WithExtraChildren>;

export type Transform = Pick<SyntaxNode, "type" | "data"> & {
  children?: (
    | Exclude<SyntaxNode["children"][number], SyntaxNode>
    | Transform
  )[];
};

export type SyntaxTreeRecord = { [key: FieldId]: SyntaxTree<WithSyntaxError> };

/**
 * SYNTAX STREAM
 */

export type SyntaxStreamSymbol =
  | { "(": true }
  | { ")": true | false } // false means it does not close anything (syntax error) - should be ignored
  | { "[": true }
  | { "]": true }
  | { "{": true }
  | { "}": true }
  | { ")": "root" }
  | { ")": "select"; f: RawFieldId }
  | { ")": "sortlimit"; l: number; s?: SortSpec }
  | { ")": Exclude<Operator | FunctionName, "select" | "sortlimit"> }
  | null;

export type SyntaxStream = StreamEntity<SyntaxStreamSymbol>[];

export type DBValue = HasDBId<Value>;
export type DBValueArray = Nested<DBValue>[];

export type DBSyntaxStream = HasDBId<StreamEntity<SyntaxStreamSymbol>>[];

export type DBSyntaxStreamBlock = {
  k: DBId<FieldId>;
  v: DBSyntaxStream;
};

export type DBValueRecord = Record<RawFieldId, DBValueArray>;

/**
 *
 *
 *
 *
 */

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
  "select",
  "sortlimit",
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
  transform?: Transform;
};

export type TemplateRef = {
  template: DocumentId;
  config?: PartialDocumentConfig;
  // Burde være nemt nok at finde label. Jeg finder label ved at finde docs template
  // og hvis den har en config, bruger jeg label derfra, ellers går jeg videre til dens templates.
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

export type PartialFieldConfig = Partial<Omit<FieldConfig, "id" | "type">> &
  Pick<FieldConfig, "id">;

export type PartialDocumentConfig = PartialFieldConfig[];

export type TemplateDocument = Omit<DBDocument, "version" | "folder">;

export interface DBDocumentRaw {
  _id: DBId<DocumentId>;
  folder: DBId<FolderId>;
  config: DocumentConfig;
  label?: string;
  versions?: Record<"config" | RawFieldId, number>;
  /* compute */
  ids: DBId<NestedDocumentId>[];
  cached: ValueArray[];
  fields: DBSyntaxStreamBlock[];
  values: DBValueRecord;
  updated: Record<RawFieldId, number>;
  fetches?: string[];
  /* */
}

export interface DBDocument {
  _id: DocumentId;
  folder: FolderId;
  config: DocumentConfig;
  record: SyntaxTreeRecord;
  // values: ValueRecord;
  label?: string;
  versions?: Record<"config" | RawFieldId, number>;
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
  _id: DBId<FolderId>;
  type: "data" | "app";
  label: string;
  spaces: Space[];
  template?: DBId<DocumentId>;
  domains?: string[];
  versions?: Record<"config" | SpaceId, number>;
}

export interface DBFolder {
  _id: FolderId;
  type: "data" | "app";
  label: string;
  spaces: Space[];
  template?: DocumentId;
  domains?: string[];
  versions?: Record<"config" | SpaceId, number>;
}

export interface Settings {
  domains: {
    id: string;
    configUrl: string;
  }[];
}

export type SearchableProps = Record<string, Record<string, boolean>>;

export type SortSpec = Record<RawFieldId, 1 | -1>;
