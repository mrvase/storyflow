import {
  createDocumentId,
  ROOT_FOLDER_NUMBER,
  TEMPLATE_FOLDER_NUMBER,
} from "./ids";
import { FolderId, SyntaxTree } from "./types";

export const ROOT_FOLDER = createDocumentId(
  ROOT_FOLDER_NUMBER
) as unknown as FolderId;

export const TEMPLATE_FOLDER = createDocumentId(
  TEMPLATE_FOLDER_NUMBER
) as unknown as FolderId;

export const DEFAULT_SYNTAX_TREE: SyntaxTree = {
  type: null,
  children: [],
};
