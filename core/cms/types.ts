import {
  Brand,
  DocumentId,
  FieldId,
  FolderId,
  FunctionDataRecord,
  FunctionName,
  NestedDocumentId,
  Operator,
  PrimitiveValue,
  RawDocumentId,
  RawFieldId,
  RawFolderId,
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

export type FunctionSymbol = {
  [Key in keyof FunctionDataRecord]: { [K in Key]: FunctionDataRecord[Key] };
}[keyof FunctionDataRecord];

/*
type KeysOfUnion<T> = T extends T ? keyof T : never;
type ValuesOfUnion<T> = T extends T ? T[keyof T] : never;
*/

export type FunctionData = FunctionDataRecord[keyof FunctionDataRecord];
export type GetFunctionData<T extends FunctionName> = Extract<
  FunctionSymbol,
  { [P in T]: any }
>[T];

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
  hidden?: boolean;
};

export type DefaultFieldConfig = FieldConfig & {
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

/* */

export type SpaceId = Brand<string, "space-id">;

/* data types */

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

export type CollabVersion = [index: number, prev: number, user: string] | [0];

export type DocumentVersionRecord = Record<
  "config" | RawFieldId,
  CollabVersion
>;

export interface DBDocument {
  _id: DocumentId;
  folder?: FolderId; // not defined on new document generated entirely from id
  config: DocumentConfig;
  record: SyntaxTreeRecord;
  versions: DocumentVersionRecord;
}

export type FolderSpace = {
  id: SpaceId;
  label?: string;
  type: "folders";
  items: FolderId[];
};

export type DocumentSpace = {
  id: SpaceId;
  label?: string;
  type: "documents";
  folder?: FolderId;
};

export type AppSpace = {
  id: SpaceId;
  type: "pages";
};

export type Space = FolderSpace | DocumentSpace | AppSpace;

export interface DBFolder {
  _id: FolderId;
  label: string;
  spaces: Space[];
  template?: DocumentId;
  domains?: string[];
}

export type DBFolderRecord = Record<RawFolderId, DBFolder>;
