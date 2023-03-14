import { calculateAsync, FetchObject } from "./calculate";
import { traverseFlatComputation } from "./flatten";
import { symb } from "./symb";
import {
  Computation,
  ComputationRecord,
  ContextToken,
  FieldId,
  NestedDocument,
  NestedField,
  Value,
} from "./types";

export const traverseFlatComputationAsync = async (
  value: Computation,
  record: ComputationRecord,
  callback: (id: FieldId, block: Computation | undefined) => Promise<any>,
  options: {
    fetch: (fetcher: FetchObject) => Promise<NestedDocument[]>;
  }
): Promise<Computation> => {
  const result = await Promise.all(
    value.map(async (el) => {
      if (el === null || typeof el !== "object") return el;
      if ("type" in el) {
        const props = Object.fromEntries(
          await Promise.all(
            Object.keys({}).map(async (name) => {
              const computation = record[name as any];
              const result = await callback(name as any, computation);
              return [name, result];
            })
          )
        );

        return {
          ...el,
          props,
        };
      } else if ("fref" in el) {
        const entries = await Promise.all(
          [].map(async (el: any) => [
            el.id.split("/")[1],
            await callback(el.id, el),
          ])
        );

        const args = Object.fromEntries(entries);
        const newEl = { ...el, args };
        return newEl;
      } else if ("id" in el && "select" in el) {
        return { $fetch: await options.fetch(el as any) };
      } else if ("id" in el) {
        const entries = await Promise.all(
          [].map(async (el: any) => [el.id, await callback(el.id, el)])
        );

        const values = Object.fromEntries(entries);
        const newEl = { ...el, values };
        return newEl;
      } else {
        return el;
      }
    })
  );

  return result.reduce((a, c) => {
    if (c !== null && typeof c === "object" && "$fetch" in c) {
      a.push(
        ...([{ "(": true }, ...(c.$fetch ?? []), { ")": true }] as Computation)
      );
    } else if (c !== undefined) {
      a.push(c as Computation[number]);
    }
    return a;
  }, [] as Computation);
};

export const calculateFlatComputationAsync = async (
  id: string,
  value: Computation,
  record: ComputationRecord,
  options: {
    fetch: (fetcher: FetchObject) => Promise<NestedDocument[]>;
  }
): Promise<Value[]> => {
  const computation = await traverseFlatComputationAsync(
    value,
    record,
    async (id, computation) => {
      if (!computation) return [];
      return await calculateFlatComputationAsync(
        id,
        computation,
        record,
        options
      );
    },
    options
  );

  const getter = async (id: FieldId | FetchObject | ContextToken) => {
    const computation = record[id as any];
    if (!computation) return [];
    return await calculateFlatComputationAsync(
      id as any,
      computation,
      record,
      options
    );
  };

  // cannot put cache here apparently.
  const result = calculateAsync(computation, getter);
  return await result;
};

export const findFetchers = (value: Computation, record: ComputationRecord) => {
  const results: FetchObject[] = [];
  const add = (value: Computation | undefined) => {
    if (value) {
      results.push(...findFetchers(value, record));
    }
  };
  const fetchers: FetchObject[] = []; // value.filter((el): el is Fetcher => symb.isFetcher(el));
  const imports = value.filter((el): el is NestedField =>
    symb.isNestedField(el)
  );
  imports.forEach((imp) => {
    const comp = record[imp.field]!;
    results.push(...findFetchers(comp, record));
  });
  results.push(...fetchers);
  traverseFlatComputation(value, record, (value) => add(value?.value as any));
  return results;
};
