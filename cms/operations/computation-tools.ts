import type { FieldId } from "@storyflow/shared/types";
import type {
  SyntaxTreeRecord,
  FieldTransform,
} from "@storyflow/fields-core/types";
import type { TokenStream } from "./types";
import { FieldOperation, isSpliceAction, isToggleAction } from "./actions";
import { tools } from "./editor-tools";
import { createSpliceTransformer } from "./splice-transform";
import { createTokenStream } from "./parse-token-stream";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/fields-core/constants";

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
