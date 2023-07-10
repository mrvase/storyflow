import {
  DocumentConfig,
  DocumentVersionRecord,
  Space,
} from "@storyflow/cms/types";
import {
  FunctionSymbol,
  OperatorSymbol,
  StreamEntity,
} from "@storyflow/cms/types";
import {
  Brand,
  DateToken,
  DocumentId,
  ExtractBrandedType,
  FieldId,
  FolderId,
  Nested,
  NestedDocumentId,
  RawFieldId,
  Value,
  ValueArray,
} from "@storyflow/shared/types";

export type Organization = { slug: string } & (
  | { db: string; version: number; permissions: Record<string, any> | false }
  | { db?: never; version?: never; permissions?: never }
);

export type User = {
  email: string;
  name: string;
  organizations: Organization[];
};

export type Settings = {
  domains: {
    id: string;
    configUrl: string;
  }[];
};

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

export type HasDate<T> = Exclude<T, DateToken> | Date;

export type DBValue = HasDate<HasDBId<Exclude<Value, DateToken>>>;

export type DBValueArray = Nested<DBValue>[];

export type DBSyntaxStream = HasDate<
  HasDBId<StreamEntity<SyntaxStreamSymbol>>
>[];

export type DBSyntaxStreamBlock = {
  k: DBId<FieldId>;
  v: DBSyntaxStream;
};

export type DBValueRecord = Record<RawFieldId, DBValueArray>;

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

// export type SyntaxStream = StreamEntity<SyntaxStreamSymbol>[];

/* raw objects */

export interface DBDocumentRaw {
  _id: DBId<DocumentId>;
  folder: DBId<FolderId>;
  config: DocumentConfig;
  label?: string;
  versions: DocumentVersionRecord;
  /* compute */
  // ids: DBId<NestedDocumentId>[];
  cached: { k: DBId<FieldId>; v: ValueArray }[];
  fields: DBSyntaxStreamBlock[];
  values: DBValueRecord;
  updated: Record<RawFieldId, number>;
  fetches?: string[];
  /* */
}

export interface DBFolderRaw {
  _id: DBId<FolderId>;
  type: "data" | "app";
  label: string;
  spaces: Space[];
  template?: DBId<DocumentId>;
  domains?: string[];
}
