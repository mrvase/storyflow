import {
  Computation,
  EditorComputation,
  FieldId,
  FlatComputation,
} from "@storyflow/core/types";
import { ComputationOp } from "./operations";
import { tools } from "./editor-tools";
import { encodeEditorComputation } from "./editor-computation";

export type InputConfig = {
  getNextState: (value: Computation, operation: ComputationOp) => Computation;
  getSpliceableValue: (value: Computation) => EditorComputation;
  getImportIds: (
    value: (Computation[number] | FlatComputation[number])[]
  ) => FieldId[];
};

const getImportIds = (
  value: (Computation[number] | FlatComputation[number])[]
) => {
  return value.reduce(
    (a, c) => (tools.isImport(c, "field") ? a.concat(c.fref) : a),
    [] as FieldId[]
  );
};

const getNextState = (compute: EditorComputation, operation: ComputationOp) => {
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

export const inputConfig: InputConfig = {
  getImportIds,
  getSpliceableValue: (value) => encodeEditorComputation(value),
  getNextState: getNextState as any,
};
