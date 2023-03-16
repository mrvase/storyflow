import {
  ContextToken,
  FieldId,
  FolderId,
  NestedDocumentId,
  RawFieldId,
  SortSpec,
} from "./types";
import { SyntaxTree, ValueArray } from "./types2";

export type FetchObject = {
  id: NestedDocumentId;
  folder: FolderId;
  limit: number;
  select: RawFieldId;
  sortBy?: SortSpec;
};

type Importers = FieldId | FetchObject | ContextToken;

type GetStateOptions = {
  returnFunction?: boolean;
  external?: boolean;
};

export function calculate(
  compute: SyntaxTree,
  getState: (id: Importers, options: GetStateOptions) => ValueArray | undefined,
  options?: {
    returnFunction?: boolean;
  }
) {}
