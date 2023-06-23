import {
  createDocumentId,
  ROOT_FOLDER_NUMBER,
  TEMPLATE_FOLDER_NUMBER,
} from "./ids";
import type { FolderId, FunctionName } from "@storyflow/shared/types";
import type { SyntaxTree } from "./types";

export const ROOT_FOLDER = createDocumentId(
  ROOT_FOLDER_NUMBER
) as unknown as FolderId;

export const TEMPLATE_FOLDER = createDocumentId(
  TEMPLATE_FOLDER_NUMBER
) as unknown as FolderId;

export const DEFAULT_SYNTAX_TREE: SyntaxTree & { type: "root" } = {
  type: "root",
  children: [],
};

export const SIGNATURES = {
  if: ["if", "then", "else"],
  in: ["element", "is in"],
  concat: [],
  fetch: ["url"],
  filter: ["elements", "where"],
  loop: ["element", "loop"],
  merge: ["element", "with"],
  root: ["root"],
  select: ["element", "select"],
  slug: ["element", "slug"],
  sum: ["element", "sum"],
  template: ["template"],
  url: ["element", "url"],
  to_date: ["til dato"],
  to_file: ["til fil"],
  to_boolean: ["til boolean"],
  to_color: ["til farve"],
  /*
  add: ["number", "+ (plus)"],
  subtract: ["number", "- (minus)"],
  multiply: ["number", "* (multiply)"],
  divide: ["number", "/ (divide)"],
  */
} as const satisfies Record<FunctionName, readonly string[]>;

export const FUNCTIONS = Object.keys(SIGNATURES) as FunctionName[];

/* TEST */

type Assert<T extends true> = T;
type Keys = keyof typeof SIGNATURES;
type AssertFunctionEquality = Assert<
  Keys extends FunctionName ? (FunctionName extends Keys ? true : false) : false
>;
