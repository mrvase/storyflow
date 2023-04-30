import {
  FieldConfig,
  FunctionSymbol,
  OperatorSymbol,
  StreamEntity,
  SyntaxTreeRecord,
} from "@storyflow/fields-core/types";
import {
  Brand,
  DocumentId,
  ExtractBrandedType,
  FieldId,
  FolderId,
  Nested,
  NestedDocumentId,
  RawFieldId,
  RawFolderId,
  Value,
  ValueArray,
} from "@storyflow/shared/types";

export type SpaceId = Brand<string, "space-id">;

export type DBId<BrandedId> = {
  id: unknown;
  toHexString(): string;
} & Partial<Brand<{}, ExtractBrandedType<BrandedId>>>;

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

/* stream */

export type SyntaxStreamSymbol =
  | { "(": true }
  | { ")": true }
  | { "[": true }
  | { "]": true }
  | { ")": false } // false means it does not close anything (syntax error) - should be ignored
  | OperatorSymbol
  | FunctionSymbol
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

export interface DBDocumentRaw {
  _id: DBId<DocumentId>;
  folder: DBId<FolderId>;
  config: DocumentConfig;
  label?: string;
  versions: Record<"config" | RawFieldId, number>;
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
  versions: Record<"config" | RawFieldId, number>;
}

export type FolderSpace = {
  id: SpaceId;
  type: "folders";
  items: FolderId[];
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

export type DBFolderRecord = Record<RawFolderId, DBFolder>;
