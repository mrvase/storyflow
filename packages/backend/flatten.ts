import {
  Computation,
  ComputationBlock,
  ComputationRecord,
  ContextToken,
  FieldId,
  Value,
} from "./types";
import { calculateSync, FetchObject } from "./calculate";

export const traverseFlatComputation = (
  value: Computation,
  record: ComputationRecord,
  callback: (block: ComputationBlock | undefined) => any
): Computation => {
  return value.map((el) => {
    if (el === null || typeof el !== "object") return el;
    if ("type" in el) {
      const props = {};
      const newEl = {
        ...el,
        props,
      };
      return newEl;
    } else if ("fref" in el) {
      const args = {};
      const newEl = { ...el, args };
      return newEl;
    } else if ("id" in el && !("filters" in el)) {
      const values = {};
      const newEl = { ...el, values };
      return newEl;
    } else {
      return el;
    }
  });
};

export const calculateFlatComputation = (
  value: Computation,
  record: ComputationRecord
): Value[] => {
  return calculateSync(
    traverseFlatComputation(value, record, (block) => {
      if (!block) return [];
      return calculateFlatComputation(block.value as Computation, record);
    }),
    (id: FieldId | FetchObject | ContextToken) => {
      // TODO
      const computation = record[id as any];
      if (!computation) return [];
      return calculateFlatComputation(computation as Computation, record);
    }
  );
};
