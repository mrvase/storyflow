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

import {
  BrandedObjectId,
  DocumentId,
  FieldId,
  FolderId,
  FunctionName,
  ImportRecord,
  NestedDocumentId,
  Operator,
  RawFieldId,
} from "./types";

export type HasBrandedObjectId<T> = T extends {
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

export type HasImports<T> = T extends {
  id: NestedDocumentId | DocumentId;
}
  ? T & {
      imports?: ImportRecord;
    }
  : T;

/*
 * SHARED TOKENS
 */

export type PrimitiveValue = string | number | boolean | Date;

export type WithPick = {
  pick?: RawFieldId;
};

export type NestedField<WithProps extends WithPick | {} = {}> = {
  id: NestedDocumentId;
  field: FieldId;
  inline?: true;
} & WithProps;

export type NestedElement = {
  id: NestedDocumentId;
  element: string;
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

export type NestedEntity = NestedElement | NestedFolder | NestedDocument;

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

/*
 * VALUE ARRAY
 */

export type Value = PrimitiveValue | Token | NestedEntity;

export type ValueArray = (Value | ValueArray)[];

/*
 * TOKEN STREAM
 */

export type OperativeToken =
  | { "(": true }
  | { ")": true }
  | { "[": true }
  | { "]": true }
  | { ",": true }
  | { _: Operator }
  | { ")": FunctionName };

export type TokenStream = (
  | Parameter
  | NestedField<WithPick>
  | LineBreak
  | Value
  | OperativeToken
)[];

/* SYNTAX TREE */

export type WithSyntaxError =
  | {
      error: "," | ")";
    }
  | {
      missing: "number";
    };

export type SyntaxNode<
  WithExtraChildren extends WithSyntaxError | never = never
> = {
  type: string | null;
  children: (
    | SyntaxNode<WithExtraChildren>
    | Parameter
    | NestedField
    | LineBreak
    | Value
    | WithExtraChildren
  )[];
  payload?: Record<string, any>;
  open?: true;
};

export type SyntaxTree<
  WithExtraChildren extends WithSyntaxError | never = never
> = SyntaxNode<WithExtraChildren>;

export type TreeRecord = { [key: FieldId]: SyntaxTree<WithSyntaxError> };

/* SYNTAX STREAM */

export type DBOperativeToken =
  | { "(": true }
  | { ")": true | false } // false means it does not close anything (syntax error) - should be ignored
  | { "[": true }
  | { "]": true }
  | { "{": true }
  | { "}": true }
  | { ")": Operator | FunctionName }
  | { p: RawFieldId };

export type DBSyntaxStream = HasImports<
  | Parameter
  | NestedField
  | NestedElement
  | NestedFolder
  | NestedDocument
  | LineBreak
  | Value
  | DBOperativeToken
>[];

export type DBStreamBlock = {
  k: BrandedObjectId<FieldId>;
  v: DBSyntaxStream;
};

export type DBValue = HasImports<Value>;
export type DBValueArray = (DBValue | DBValueArray)[];
export type DBValueRecord = Record<RawFieldId, DBValueArray>;
