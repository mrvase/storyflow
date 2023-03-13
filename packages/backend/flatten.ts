import {
  Computation,
  ComputationBlock,
  DBDocument,
  DBSymbol,
  FieldId,
  FieldImport,
  FlatComputation,
  FlatComputationRecord,
  FlatFieldImport,
  FlatLayoutElement,
  FlatNestedDocument,
  LayoutElement,
  NestedDocument,
  NonNestedComputation,
  TemplateFieldId,
  Value,
} from "./types";
import { traverse } from "./traverse";
import { computeFieldId, getTemplateFieldId } from "./ids";
import { symb } from "./symb";
import { calculateSync } from "./calculate";

export const toFlatComputation = (
  value: NonNestedComputation,
  isSearchable: (type: string, name: string) => boolean
): FlatComputation => {
  return value.map((el) => {
    if (symb.isLayoutElement(el)) {
      return {
        ...el,
        props: Object.fromEntries(
          Object.entries(el.props).map(([key]) => [
            key,
            isSearchable(el.type, key),
          ])
        ),
      } as FlatLayoutElement;
    } else if (symb.isFieldImport(el)) {
      const { args, ...newEl } = el;
      return newEl as FlatFieldImport;
    } else if (symb.isNestedDocument(el)) {
      const { values, ...newEl } = el;
      return newEl as FlatNestedDocument;
    } else {
      return el;
    }
  });
};

export const flattenComputation = (
  value: NonNestedComputation,
  isSearchable: (type: string, name: string) => boolean
): FlatComputationRecord => {
  const result = new Map<string, FlatComputation>();
  traverse(value, (value, path) => {
    result.set(path, toFlatComputation(value, isSearchable));
  });
  return Object.fromEntries(result.entries());
};

export const traverseFlatComputation = (
  value: FlatComputation,
  compute: ComputationBlock[],
  callback: (block: ComputationBlock | undefined) => any
): Computation => {
  return value.map((el) => {
    if (el === null || typeof el !== "object") return el;
    if ("type" in el) {
      const props = Object.fromEntries(
        Object.keys(el.props).map((key) => {
          const computation = compute.find(({ id }) =>
            id.match(new RegExp(`${el.id}\/${key}\#?`))
          );
          return [key, callback(computation)];
        })
      );
      const newEl: LayoutElement = {
        ...el,
        props,
      };
      return newEl;
    } else if ("fref" in el) {
      const args = Object.fromEntries(
        compute
          .filter(({ id }) => id.startsWith(el.id))
          .map((el) => [el.id.split("/")[1], callback(el)])
      );
      const newEl: FieldImport = { ...el, args };
      return newEl;
    } else if ("id" in el && !("filters" in el)) {
      const values = Object.fromEntries(
        compute
          .filter((el) => el.id.startsWith(el.id))
          .map((el) => [getTemplateFieldId(el.id), callback(el)])
      );
      const newEl: NestedDocument = { ...el, values };
      return newEl;
    } else {
      return el;
    }
  });
};

export const calculateFlatComputation = (
  id: string,
  value: FlatComputation,
  compute: ComputationBlock[]
): Value[] => {
  return calculateSync(
    id,
    traverseFlatComputation(value, compute, (block) => {
      if (!block) return [];
      return calculateFlatComputation(
        block.id,
        block.value as FlatComputation,
        compute
      );
    }),
    (_id: string) => {
      const id = _id.indexOf(".") > 0 ? _id.split(".")[1] : _id;
      const computation = compute.find((el) => el.id === id)?.value;
      if (!computation) return [];
      return calculateFlatComputation(
        id,
        computation as FlatComputation,
        compute
      );
    }
  );
};

export const restoreComputation = (
  value: FlatComputation,
  compute: ComputationBlock[]
): Computation => {
  const restore = (value: ComputationBlock | undefined) => {
    return restoreComputation(value?.value ?? [], compute);
  };
  return traverseFlatComputation(value, compute, restore);
};

export const getChildrenFromFlatComputation = (
  value: FlatComputation,
  compute: ComputationBlock[],
  parentDepth: number = 0
): (ComputationBlock & { depth: number })[] => {
  const results: (ComputationBlock & { depth: number })[] = [];
  const add = (value: ComputationBlock | undefined, depth = 0) => {
    if (value) {
      results.push(
        { ...value, depth },
        ...getChildrenFromFlatComputation(value.value, compute, depth)
      );
    }
  };
  traverseFlatComputation(value, compute, (value) =>
    add(value, parentDepth + 1)
  );
  return results;
};
