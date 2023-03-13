import {
  Computation,
  ComputationRecord,
  DocumentId,
  EditorComputation,
  FieldId,
  FlatComputation,
  FlatComputationRecord,
} from "@storyflow/backend/types";
import { ComputationOp, targetTools } from "./operations";
import { tools } from "./editor-tools";
import { encodeEditorComputation } from "./editor-computation";
import { computeFieldId } from "@storyflow/backend/ids";
import { createSpliceTransformer } from "./splice-transform";
import { getNestedChild } from "@storyflow/backend/traverse";

type SomeComputation = (Computation[number] | FlatComputation[number])[];

export const getPickedDocumentIds = (
  fref: FieldId,
  pool: ComputationRecord | FlatComputationRecord
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
    if (tools.isFieldImport(c)) {
      drefs.push(...getPickedDocumentIds(c.fref, pool));
    } else if (i > 0 && tools.isDBSymbol(c, "p")) {
      const prev = value[i - 1];
      if (tools.isFieldImport(prev)) {
        const secondaryDrefs = getPickedDocumentIds(prev.fref, pool);
        secondaryDrefs.forEach((dref) => {
          const id = computeFieldId(dref, c.p);
          drefs.push(...getPickedDocumentIds(id, pool));
        });
      }
    } else if (tools.isDocumentImport(c)) {
      drefs.push(c.dref);
    }
  }, [] as FieldId[]);

  return drefs;
};

export const getImportIds = (
  value: SomeComputation,
  pool: ComputationRecord | FlatComputationRecord
) => {
  const imports: FieldId[] = [];

  value.forEach((c, i) => {
    if (tools.isFieldImport(c)) {
      imports.push(c.fref);
    } else if (i > 0 && tools.isDBSymbol(c, "p")) {
      const prev = value[i - 1];
      if (tools.isFieldImport(prev)) {
        const drefs = getPickedDocumentIds(prev.fref, pool);
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
