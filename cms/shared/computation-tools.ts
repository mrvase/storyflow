import {
  Computation,
  ComputationRecord,
  DBDocumentRaw,
  DocumentId,
  EditorComputation,
  FieldId,
  NestedDocumentId,
  RawFieldId,
} from "@storyflow/backend/types";
import { ComputationOp, targetTools } from "./operations";
import { tools } from "./editor-tools";
import { encodeEditorComputation } from "./editor-computation";
import {
  computeFieldId,
  isFieldOfDocument,
  isNestedDocumentId,
  unwrapObjectId,
} from "@storyflow/backend/ids";
import { createSpliceTransformer } from "./splice-transform";
import { getNestedChild } from "@storyflow/backend/traverse";

export const getPickedDocumentIds = (
  fref: FieldId,
  pool: ComputationRecord
) => {
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

  value.forEach((c, i) => {
    if (tools.isNestedField(c)) {
      drefs.push(...getPickedDocumentIds(c.field, pool));
    } else if (i > 0 && tools.isDBSymbol(c, "p")) {
      const prev = value[i - 1];
      if (tools.isNestedField(prev)) {
        const secondaryDrefs = getPickedDocumentIds(prev.field, pool);
        secondaryDrefs.forEach((dref) => {
          const id = computeFieldId(dref, c.p);
          drefs.push(...getPickedDocumentIds(id, pool));
        });
      }
    } else if (tools.isNestedDocument(c) && !isNestedDocumentId(c.id)) {
      drefs.push(c.id);
    }
  }, [] as FieldId[]);

  return drefs;
};

export const getImportIds = (value: Computation, pool: ComputationRecord) => {
  const imports: FieldId[] = [];

  value.forEach((c, i) => {
    if (tools.isNestedField(c)) {
      imports.push(c.field);
    } else if (i > 0 && tools.isDBSymbol(c, "p")) {
      const prev = value[i - 1];
      if (tools.isNestedField(prev)) {
        const drefs = getPickedDocumentIds(prev.field, pool);
        drefs.forEach((dref) => imports.push(computeFieldId(dref, c.p)));
      }
    }
  }, [] as FieldId[]);

  return imports;
};

export const getNextState = (
  compute: EditorComputation,
  operation: ComputationOp
) => {
  /**
   * if it is root, it should remove arguments before altering
   */

  let newValue = compute;
  let removed: EditorComputation = [];
  operation.ops.forEach((action) => {
    const { index, insert = [], remove = 0 } = action;
    const move = !action.insert && !action.remove;
    if (move) {
      newValue = tools.concat(
        tools.slice(newValue, 0, index),
        removed,
        tools.slice(newValue, index)
      );
    } else {
      if (remove > 0) {
        removed = tools.slice(newValue, index, index + remove);
        const slice1 = tools.slice(newValue, 0, index);
        const slice2 = tools.slice(newValue, index + remove);
        newValue = tools.concat(slice1, slice2);
      }
      if (insert.length > 0 && !(insert.length === 1 && insert[0] === "")) {
        newValue = tools.concat(
          tools.slice(newValue, 0, index),
          insert,
          tools.slice(newValue, index)
        );
      }
    }
  });

  return newValue;
};

const getArrayMethods = (operation: ComputationOp) => {
  // const { input } = targetTools.parse(operation.target);
  return {
    splice: tools.slice,
    getLength: tools.getLength,
  };
};

export const createComputationTransformer = (initialValue: Computation) => {
  const getInitialValue = (operation: ComputationOp) => {
    const { location: path, input } = targetTools.parse(operation.target);

    if (path === "") {
      return encodeEditorComputation(initialValue);
    }

    try {
      const child = getNestedChild(initialValue, path.split("."));
      if (!child) throw "error";
      return encodeEditorComputation(child);
    } catch (err) {
      return []; // it is safe to assume it is something of length 0
    }
  };
  return createSpliceTransformer<ComputationOp>(
    getInitialValue,
    getArrayMethods
  );
};

export const getComputationRecord = (
  documentId: DocumentId,
  doc: Pick<DBDocumentRaw, "compute" | "values">
): ComputationRecord => {
  const fields = Object.fromEntries(
    doc.compute.map(({ id, value }) => [unwrapObjectId(id), value])
  );
  Object.entries(doc.values).forEach(([id, value]) => {
    const fieldId = computeFieldId(documentId, id as RawFieldId);
    if (!(fieldId in fields)) {
      fields[fieldId] = value as Computation;
    }
  });
  return fields;
};

export const getComputationEntries = (record: ComputationRecord) => {
  return Object.entries(record) as [FieldId, Computation][];
};

export type ComputationGraph = {
  imports: Map<FieldId, FieldId[]>;
  children: Map<FieldId, FieldId[]>;
};

export const getChildrenDocuments = (value: Computation) => {
  const children: NestedDocumentId[] = [];
  value.forEach((el) => {
    if (el === null || typeof el !== "object") return el;
    if ("id" in el && isNestedDocumentId(el.id)) {
      children.push(el.id);
    }
  });
  return Array.from(children);
};

export const getGraph = (
  computationRecord: ComputationRecord,
  initialGraph: Partial<ComputationGraph> = {}
): ComputationGraph => {
  let imports = initialGraph.imports ?? new Map<FieldId, FieldId[]>();
  let children = initialGraph.children ?? new Map<FieldId, FieldId[]>();

  const entries = getComputationEntries(computationRecord);

  entries.map(([fieldId, computation]) => {
    const importIds = getImportIds(computation, computationRecord);

    const childrenDocuments = getChildrenDocuments(computation);
    const childrenIds: FieldId[] = [];
    childrenDocuments.forEach((documentId) => {
      entries.forEach(([fieldId]) => {
        if (isFieldOfDocument(fieldId, documentId)) {
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
  record: ComputationRecord,
  fieldId: FieldId,
  graph: ComputationGraph
) => {
  const { imports, children } = graph;

  const fieldRecord: ComputationRecord = {};

  const addDerivatives = (fieldId: FieldId) => {
    if (fieldId in fieldRecord) return;
    fieldRecord[fieldId] = record[fieldId];
    imports.get(fieldId)?.forEach(addDerivatives);
    children.get(fieldId)?.forEach(addDerivatives);
  };
  addDerivatives(fieldId);

  return fieldRecord;
};

export const extractRootRecord = (
  documentId: DocumentId,
  record: ComputationRecord
) => {
  const graph = getGraph(record);

  const rootFieldIds = (Object.keys(record) as FieldId[]).filter((el) =>
    isFieldOfDocument(el, documentId)
  );

  const rootRecord: ComputationRecord = {};

  rootFieldIds.forEach((fieldId) => {
    Object.assign(rootRecord, getFieldRecord(record, fieldId, graph));
  });

  return rootRecord;
};
