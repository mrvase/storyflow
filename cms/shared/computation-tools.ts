import {
  DBDocumentRaw,
  DocumentId,
  FieldId,
  NestedField,
  RawFieldId,
  SyntaxNode,
  SyntaxTree,
  TokenStream,
  SyntaxTreeRecord,
  NestedDocument,
  NestedElement,
  NestedFolder,
  Transform,
} from "@storyflow/backend/types";
import { FieldOperation, isSpliceAction, isToggleAction } from "./operations";
import { tools } from "./editor-tools";
import {
  computeFieldId,
  isFieldOfDocument,
  isNestedDocumentId,
  unwrapObjectId,
} from "@storyflow/backend/ids";
import { createSpliceTransformer } from "./splice-transform";
import { createTokenStream } from "./parse-token-stream";
import { parseSyntaxStream } from "./parse-syntax-stream";
import { tokens } from "@storyflow/backend/tokens";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { isSyntaxTree } from "@storyflow/backend/syntax-tree";

export const traverseSyntaxTree = (
  tree: SyntaxTree,
  callback: (token: Exclude<SyntaxTree["children"][number], SyntaxNode>) => void
) => {
  const traverseNode = (node: SyntaxTree) => {
    node.children.forEach((token) => {
      if (isSyntaxTree(token)) {
        traverseNode(token);
      } else {
        callback(token);
      }
    });
  };
  traverseNode(tree);
};

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
            const id = computeFieldId(dref, token.data!.select);
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
          drefs.forEach((dref) =>
            imports.push(computeFieldId(dref, token.data!.select))
          );
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

// applyFieldOperation
export const applyFieldOperation = (
  state: { stream: TokenStream; transforms: Transform[] },
  operation: FieldOperation
): { stream: TokenStream; transforms: Transform[] } => {
  let newStream = state.stream;
  let newTransforms = state.transforms;
  let removed: TokenStream = [];
  operation[1].forEach((action) => {
    if (isSpliceAction(action)) {
      const { index, insert = [], remove = 0 } = action;
      const move = !action.insert && !action.remove;
      if (move) {
        newStream = tools.concat(
          tools.slice(newStream, 0, index),
          removed,
          tools.slice(newStream, index)
        );
      } else {
        if (remove > 0) {
          removed = tools.slice(newStream, index, index + remove);
          const slice1 = tools.slice(newStream, 0, index);
          const slice2 = tools.slice(newStream, index + remove);
          newStream = tools.concat(slice1, slice2);
        }
        if (insert.length > 0 && !(insert.length === 1 && insert[0] === "")) {
          newStream = tools.concat(
            tools.slice(newStream, 0, index),
            insert,
            tools.slice(newStream, index)
          );
        }
      }
    } else if (isToggleAction(action)) {
      const index = newTransforms.findIndex((t) => t.type === action.name);
      if (index >= 0) {
        if (action.value === null) {
          // delete
          newTransforms.splice(index, 1);
        } else {
          // update
          newTransforms[index] = {
            type: action.name,
            ...(action.value !== true && { value: action.value }),
          };
        }
      } else {
        if (action.value !== null) {
          // create
          newTransforms.push({
            type: action.name,
            ...(action.value !== true && { value: action.value }),
          });
        }
      }
      // TODO
    }
  });

  return {
    stream: newStream,
    transforms: newTransforms,
  };
};

const arrayMethods = {
  splice: tools.slice,
  getLength: tools.getLength,
};

export const createTokenStreamTransformer = (
  fieldId: FieldId,
  initialRecord: SyntaxTreeRecord
) => {
  const getInitialValue = (operation: FieldOperation) => {
    const target = operation[0];

    if (target === "") {
      let value = initialRecord[fieldId] ?? DEFAULT_SYNTAX_TREE;
      return createTokenStream(value);
    }

    let value = initialRecord[target as FieldId] ?? DEFAULT_SYNTAX_TREE;
    return createTokenStream(value);
  };
  return createSpliceTransformer<FieldOperation>(getInitialValue, arrayMethods);
};

export const getSyntaxTreeRecord = (
  documentId: DocumentId,
  doc: Pick<DBDocumentRaw, "fields" | "values">
): SyntaxTreeRecord => {
  const fields = Object.fromEntries(
    doc.fields.map(({ k, v }) => [unwrapObjectId(k), parseSyntaxStream(v)])
  );
  Object.entries(doc.values).forEach(([id, value]) => {
    const fieldId = computeFieldId(documentId, id as RawFieldId);
    if (!(fieldId in fields)) {
      fields[fieldId] = parseSyntaxStream(value);
    }
  });
  return fields;
};

export const getSyntaxTreeEntries = (record: SyntaxTreeRecord) => {
  return Object.entries(record) as [FieldId, SyntaxTree][];
};

export type ComputationGraph = {
  imports: Map<FieldId, FieldId[]>;
  children: Map<FieldId, FieldId[]>;
};

export const getChildrenDocuments = (value: SyntaxTree) => {
  const children = new Set<
    NestedField | NestedElement | NestedFolder | NestedDocument
  >();

  const traverseNode = (node: SyntaxTree) => {
    node.children.forEach((token) => {
      if (isSyntaxTree(token)) {
        traverseNode(token);
      } else if (tokens.isNestedEntity(token) && isNestedDocumentId(token.id)) {
        children.add(token);
      }
    });
  };

  traverseNode(value);

  return Array.from(children);
};

export const getGraph = (
  computationRecord: SyntaxTreeRecord,
  initialGraph: Partial<ComputationGraph> = {}
): ComputationGraph => {
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
  graph: ComputationGraph
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
