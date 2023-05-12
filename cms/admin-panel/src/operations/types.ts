import type { FunctionSymbol, StreamEntity } from "@storyflow/cms/types";
import {
  DocumentId,
  FieldId,
  NestedDocumentId,
  Operator,
  RawDocumentId,
  RawFieldId,
} from "@storyflow/shared/types";

export type HasSelect<T> = T extends {
  id: NestedDocumentId | DocumentId;
  field: FieldId;
}
  ? T & {
      select?: RawFieldId;
      loop?: RawDocumentId;
    }
  : T;

export type TokenStreamSymbol =
  | { "(": true }
  | { ")": true }
  | { "[": true }
  | { "]": true }
  | { ",": true }
  | { _: Operator }
  | FunctionSymbol;

export type TokenStream = HasSelect<StreamEntity<TokenStreamSymbol>>[];
