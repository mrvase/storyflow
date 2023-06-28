import {
  FieldId,
  DocumentId,
  ClientSyntaxTree,
  NestedElement,
  NestedFolder,
  NestedDocument,
} from "@storyflow/shared/types";
import { DEFAULT_SYNTAX_TREE } from "./constants";
import { computeFieldId, isNestedDocumentId, isFieldOfDocument } from "./ids";
import { isSyntaxTree, getSyntaxTreeEntries } from "./syntax-tree";
import { tokens } from "./tokens";
import type { SyntaxTreeRecord, SyntaxTree, NestedField } from "./types";

export const getPickedDocumentIds = (fref: FieldId, pool: SyntaxTreeRecord) => {
  /*
  This function is very greedy.
  It does not care about the logic of the computation.
  Some drefs might never be included in the result of the computation, for instance if they are part of a condition.
  But we count them in anyways.
  E.g: [
    { "(": true },
      { "(": true },
        { dref: "a"},
        "a" or "b",
      { ")": "=" },
      { dref: "b"},
      { dref: "c" },
    { ")": "if"}
  ]
  This can only return { dref: "b" } and { dref: "c" }, but we count { dref: "a" } in also for the sake of simplicity.

  TODO: Should handle picked nested document ids as well
  TODO: Does not get drefs/nd-ids from parameters
  TODO: Does not get drefs/nd-ids from nested document fields

  Assumptions:
  - pick always takes a field import as argument, not direct document imports
  */

  const drefs: DocumentId[] = [];

  const value = pool[fref];
  if (!value) return [];

  const traverseNode = (node: SyntaxTree) => {
    node.children.forEach((token) => {
      if (isSyntaxTree(token)) {
        if (token.type === "select") {
          const child = token.children[0] as NestedField;
          const secondaryDrefs = getPickedDocumentIds(child.field, pool);
          secondaryDrefs.forEach((dref) => {
            const id = computeFieldId(dref, token.data!);
            drefs.push(...getPickedDocumentIds(id, pool));
          });
        } else {
          traverseNode(token);
        }
      } else if (tokens.isNestedField(token)) {
        drefs.push(...getPickedDocumentIds(token.field, pool));
      } else if (
        tokens.isNestedDocument(token) &&
        !isNestedDocumentId(token.id)
      ) {
        drefs.push(token.id);
      }
    });
  };

  traverseNode(value);

  return drefs;
};

export const getImportIds = (value: SyntaxTree, pool: SyntaxTreeRecord) => {
  const imports: FieldId[] = [];

  const traverseNode = (node: SyntaxTree) => {
    node.children.forEach((token) => {
      if (isSyntaxTree(token)) {
        if (token.type === "select") {
          const child = token.children[0] as NestedField;
          imports.push(child.field);
          const drefs = getPickedDocumentIds(child.field, pool);
          drefs.forEach((dref) => {
            imports.push(computeFieldId(dref, token.data!));
          });
        } else {
          traverseNode(token);
        }
      } else if (tokens.isNestedField(token)) {
        imports.push(token.field);
      }
    });
  };

  traverseNode(value);

  return imports;
};

export function getChildrenDocuments(
  value: SyntaxTree | ClientSyntaxTree,
  type: "field"
): NestedField[];
export function getChildrenDocuments(
  value: SyntaxTree | ClientSyntaxTree,
  type: "document"
): NestedDocument[];
export function getChildrenDocuments(
  value: SyntaxTree | ClientSyntaxTree,
  type: "folder"
): NestedFolder[];
export function getChildrenDocuments(
  value: SyntaxTree | ClientSyntaxTree,
  type: "element"
): NestedElement[];
export function getChildrenDocuments(
  value: SyntaxTree | ClientSyntaxTree
): (NestedField | NestedElement | NestedFolder | NestedDocument)[];
export function getChildrenDocuments(
  value: SyntaxTree | ClientSyntaxTree,
  type?: "element" | "document" | "field" | "folder"
) {
  const children = new Set<
    NestedField | NestedElement | NestedFolder | NestedDocument
  >();

  const tester = {
    default: tokens.isNestedEntity,
    element: tokens.isNestedElement,
    document: tokens.isNestedDocument,
    field: tokens.isNestedField,
    folder: tokens.isNestedFolder,
  }[type ?? "default"];

  const traverseNode = (node: SyntaxTree | ClientSyntaxTree) => {
    const check = (
      token:
        | SyntaxTree["children"][number]
        | ClientSyntaxTree["children"][number]
    ) => {
      if (isSyntaxTree(token)) {
        traverseNode(token);
      } else if (Array.isArray(token)) {
        token.forEach(check);
      } else if (tester(token) && isNestedDocumentId(token.id)) {
        children.add(token);
      }
    };

    node.children.forEach(check);
  };

  traverseNode(value);

  return Array.from(children);
}

export type FieldGraph = {
  imports: Map<FieldId, FieldId[]>;
  children: Map<FieldId, FieldId[]>;
};

export const getGraph = (
  computationRecord: SyntaxTreeRecord,
  initialGraph: Partial<FieldGraph> = {}
): FieldGraph => {
  let imports = initialGraph.imports ?? new Map<FieldId, FieldId[]>();
  let children = initialGraph.children ?? new Map<FieldId, FieldId[]>();

  const entries = getSyntaxTreeEntries(computationRecord);

  entries.map(([fieldId, computation]) => {
    const importIds = getImportIds(computation, computationRecord);

    const childrenDocuments = getChildrenDocuments(computation);
    const childrenIds: FieldId[] = [];
    childrenDocuments.forEach((doc) => {
      entries.forEach(([fieldId]) => {
        if (isFieldOfDocument(fieldId, doc.id)) {
          childrenIds.push(fieldId);
        }
      });
    });

    children.set(fieldId, childrenIds);
    imports.set(fieldId, importIds);
  });

  return { imports, children };
};

export const getFieldRecord = (
  record: SyntaxTreeRecord,
  fieldId: FieldId,
  graph: FieldGraph
) => {
  const { imports, children } = graph;

  const fieldRecord: SyntaxTreeRecord = {};

  const addWithDerivatives = (fieldId: FieldId) => {
    if (fieldId in fieldRecord) return;
    fieldRecord[fieldId] = record[fieldId] ?? DEFAULT_SYNTAX_TREE;
    imports.get(fieldId)?.forEach(addWithDerivatives);
    children.get(fieldId)?.forEach(addWithDerivatives);
  };

  addWithDerivatives(fieldId);

  return fieldRecord;
};

export const extractRootRecord = (
  documentId: DocumentId,
  record: SyntaxTreeRecord,
  options: {
    excludeImports?: boolean;
  } = {}
) => {
  const graph = getGraph(record);

  if (options.excludeImports) {
    graph.imports = new Map();
  }

  const rootFieldIds = (Object.keys(record) as FieldId[]).filter((el) =>
    isFieldOfDocument(el, documentId)
  );

  const rootRecord: SyntaxTreeRecord = {};

  rootFieldIds.forEach((fieldId) => {
    Object.assign(rootRecord, getFieldRecord(record, fieldId, graph));
  });

  return rootRecord;
};
