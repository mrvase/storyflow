import type { FieldId } from "@storyflow/shared/types";
import type {
  SyntaxTreeRecord,
  FieldTransform,
} from "@storyflow/fields-core/types";
import type { TokenStream } from "./types";
import { FieldOperation, isSpliceAction, isToggleAction } from "./actions";
import { tools } from "./stream-methods";
import { createSpliceTransformer } from "./splice-transform_old";
import { createSpliceTransformer as createSpliceTransformer2 } from "./splice-transform";
import { createTokenStream } from "./parse-token-stream";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/fields-core/constants";
import { FieldTransactionEntry } from "./actions_new";
import { isSpliceOperation, isToggleOperation } from "@storyflow/collab/utils";

export const applyFieldOperation = (
  state: { stream: TokenStream; transforms: FieldTransform[] },
  operation: FieldOperation
): { stream: TokenStream; transforms: FieldTransform[] } => {
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
          const currentlyRemoved = tools.slice(
            newStream,
            index,
            index + remove
          );
          removed.push(...currentlyRemoved);
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
            ...(action.value !== true && { data: action.value }),
          };
        }
      } else {
        if (action.value !== null) {
          // create
          newTransforms.push({
            type: action.name,
            ...(action.value !== true && { data: action.value }),
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

export const applyFieldTransaction = (
  state: { stream: TokenStream; transforms: FieldTransform[] },
  transaction: FieldTransactionEntry
): { stream: TokenStream; transforms: FieldTransform[] } => {
  let newStream = state.stream;
  let newTransforms = state.transforms;
  let removed: TokenStream = [];
  transaction[1].forEach((operation) => {
    if (isSpliceOperation(operation)) {
      const [index, remove = 0, insert = []] = operation;
      const move = !insert.length && !remove;
      if (move) {
        newStream = tools.concat(
          tools.slice(newStream, 0, index),
          removed,
          tools.slice(newStream, index)
        );
      } else {
        if (remove > 0) {
          const currentlyRemoved = tools.slice(
            newStream,
            index,
            index + remove
          );
          removed.push(...currentlyRemoved);
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
    } else if (isToggleOperation(operation)) {
      const [name, value] = operation;
      const index = newTransforms.findIndex((t) => t.type === name);
      if (index >= 0) {
        if (value === null) {
          // delete
          newTransforms.splice(index, 1);
        } else {
          // update
          newTransforms[index] = {
            type: name,
            ...(value !== true && { data: value }),
          };
        }
      } else {
        if (value !== null) {
          // create
          newTransforms.push({
            type: name,
            ...(value !== true && { data: value }),
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

// createDocumentTransformer
/*
export const createTokenStreamTransformer = (
  fieldId: FieldId,
  initialRecord: SyntaxTreeRecord
) => {
  const getInitialLength = (target: string) => {
    const id = target === "" ? fieldId : (target as FieldId);
    let value = createTokenStream(initialRecord[id] ?? DEFAULT_SYNTAX_TREE);
    return tools.getLength(value);
  };
  return createSpliceTransformer<FieldOperation>(
    getInitialLength,
    (target, value) => tools.getLength(value)
  );
};
*/

export const createDocumentTransformer = (initialRecord: SyntaxTreeRecord) => {
  const getInitialLength = (target: string) => {
    const id = target as FieldId;
    let value = createTokenStream(initialRecord[id] ?? DEFAULT_SYNTAX_TREE);
    return tools.getLength(value);
  };
  return createSpliceTransformer2(getInitialLength, (target, value) => {
    if (target === "config") {
      return value.length;
    }
    return tools.getLength(value);
  });
};
