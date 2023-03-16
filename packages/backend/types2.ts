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
  WithBrandedObjectId,
} from "./types";

/*
 * SHARED TOKENS
 */

export type PrimitiveValue = string | number | boolean | Date;

export type FieldReference = {
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
  | FieldReference
  | LineBreak
  | Value
  | OperativeToken
)[];

/* SYNTAX TREE */

export type WithSyntaxError = {
  error: "," | "(" | ")";
};

export type SyntaxNode<WithErrorOrNever = never> = {
  type: string | null;
  children: SyntaxTree<WithErrorOrNever>;
};

export type SyntaxTree<WithErrorOrNever = never> = (
  | SyntaxNode<WithErrorOrNever>
  | Value
  | LineBreak
  | WithErrorOrNever
)[];

export type TreeRecord = { [key: FieldId]: SyntaxTree<WithSyntaxError> };

/* SYNTAX STREAM */

export type DBOperativeToken =
  | { "(": true }
  | { ")": true }
  | { "[": true }
  | { "]": true }
  | { "{": true }
  | { "|": true }
  | { "}": true }
  | { ")": Operator | FunctionName }
  | { p: RawFieldId };

export type DBSyntaxStream = WithBrandedObjectId<
  Parameter | FieldReference | LineBreak | Value | DBOperativeToken
>[];

export type DBStreamBlock = {
  k: BrandedObjectId<FieldId>;
  v: DBSyntaxStream;
};

export type DBValue = WithBrandedObjectId<Value>;
export type DBValueArray = (DBValue | DBValueArray)[];
export type DBValueRecord = Record<RawFieldId, DBValueArray>;
