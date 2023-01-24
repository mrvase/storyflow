import { tools } from "shared/editor-tools";
import { InferAction, ComputationOp } from "shared/operations";
import { EditorComputation } from "@storyflow/backend/types";

type Action = InferAction<ComputationOp>;

export const getComputationDiff = (
  _oldValue: EditorComputation,
  _newValue: EditorComputation
): Action[] | null => {
  const split = (value: EditorComputation) => {
    const array: EditorComputation = [];
    tools.forEach(value, (el) => {
      array.push(el);
    });
    return array;
  };
  const oldValue = split(_oldValue);
  const newValue = split(_newValue);
  const oldLength = oldValue.length;
  const newLength = newValue.length;
  const diff = newLength - oldLength;

  if (
    newLength === oldLength &&
    newValue.every((el, i) => el === oldValue[i])
  ) {
    console.timeEnd("a");
    return null;
  }

  const reverse = diff < 0;
  const longValue = reverse ? oldValue : newValue;
  const shortValue = reverse ? newValue : oldValue;

  const longLength = reverse ? oldLength : newLength;
  const shortLength = reverse ? newLength : oldLength;

  let left: number | null = null;
  let right: number | null = null;

  if (tools.getLength(longValue) === 1) {
    // shortValue === 0 or 1
    left = 0;
    right = 1;
  } else {
    // look for change
    for (let i = 0; i < longLength; i++) {
      if (left === null && !tools.equals([longValue[i]], [shortValue[i]])) {
        left = i;
      }
      if (
        right === null &&
        !tools.equals(
          [longValue[longLength - 1 - i]],
          [shortValue[shortLength - 1 - i]]
        )
      ) {
        right = longLength - i;
      }

      if (left !== null && right !== null) {
        break;
      }
    }
    /*
    tools.forEach(longValue, (longValueEl, i) => {
      let longIndex = longLength - 1 - i;
      let shortIndex = shortLength - 1 - i;

      if (
        left === null &&
        !tools.equals([longValueEl], [tools.at(shortValue, i)!])
      ) {
        left = i;
      }
      if (
        right === null &&
        !tools.equals(
          [tools.at(longValue, longIndex)!],
          [tools.at(shortValue, shortIndex)!]
        )
      ) {
        right = longLength - i;
      }

      if (left !== null && right !== null) {
        return true;
      }
    });
    */

    if (left === null || right === null) {
      // no change
      return null;
    }

    if (diff !== 0 && right - left < Math.abs(diff)) {
      right = left + Math.abs(diff);
    }
  }

  let insert = tools.slice(longValue, left, right);
  let remove = tools.slice(shortValue, left, right - Math.abs(diff));

  /*
  this is a trick to avoid assigning a new value to e.g.
  insert before it is read in the assignment of remove
  */
  ({ insert, remove } = {
    insert: reverse ? remove : insert,
    remove: reverse ? insert : remove,
  });

  if (
    tools.equals(
      tools.removeCharacters(insert, "\\*+"),
      tools.removeCharacters(remove, "\\*+")
    )
  ) {
    const find = (value: EditorComputation) => tools.match(value, "\\*+")[0];
    let match: { index: number; value: string | ["n"] } | null;

    let insertText = insert;
    let insertMatches = [] as { value: string | ["n"]; index: number }[];
    match = find(insertText);
    while (typeof match?.index === "number") {
      insertText = tools.concat(
        tools.slice(insertText, 0, match.index),
        tools.slice(insertText, match.index + match.value.length)
      );
      insertMatches.push({ value: match.value, index: match.index });
      match = find(insertText);
    }

    let removeText = remove;
    let removeMatches = [] as { value: string | ["n"]; index: number }[];
    match = find(removeText);
    while (typeof match?.index === "number") {
      removeText = tools.concat(
        tools.slice(removeText, 0, match.index),
        tools.slice(removeText, match.index + match.value.length)
      );
      removeMatches.push({ value: match.value, index: match.index });
      match = find(removeText);
    }

    const actions: Action[] = [];

    for (let match of removeMatches) {
      actions.push({
        index: left + match.index,
        insert: [],
        remove: match.value.length,
      });
    }
    for (let match of insertMatches.slice().reverse()) {
      actions.push({
        index: left + match.index,
        insert: [match.value],
        remove: 0,
      });
    }

    return actions;
  }

  return [{ index: left, insert, remove: tools.getLength(remove) }];
};

/*
if (diff === 0) {
  let insert = newValue.slice(left, right);
  let remove = oldValue.slice(left, right);
  return { anchor: left, focus: left + remove.length, insert, remove };
} else {
  let insert = longValue.slice(left, right);
  let remove = "";
  if (right - left > Math.abs(diff)) {
    remove = shortValue.slice(left, right - Math.abs(diff));
  }
  return reverse
    ? {
        anchor: left,
        focus: left + insert.length,
        remove: insert,
        insert: remove,
      }
    : { anchor: left, focus: left + remove.length, insert, remove };
}
*/
