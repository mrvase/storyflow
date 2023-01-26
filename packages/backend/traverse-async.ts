import { calculateAsync } from "./calculate-async";
import { traverseFlatComputation } from "./flatten";
import { getTemplateFieldId } from "./ids";
import { symb } from "./symb";
import {
  Computation,
  ComputationBlock,
  Fetcher,
  FieldImport,
  FlatComputation,
  LayoutElement,
  NestedDocument,
  Value,
} from "./types";
import type { Library, LibraryConfig } from "@storyflow/frontend/types";

const getConfigFromType = (type: string, libraries: LibraryConfig[]) => {
  const [library, name] = type.split(":");
  const config = libraries.find((el) => el.name === library);

  if (!config) return;

  const result = Object.entries(config.components).find(
    ([, el]) => el.name === name
  );

  return result;
};

export const traverseFlatComputationAsync = async (
  value: FlatComputation,
  compute: ComputationBlock[],
  callback: (block: ComputationBlock | undefined) => Promise<any>,
  options: {
    fetch: (fetcher: Fetcher) => Promise<NestedDocument[]>;
    libraries: LibraryConfig[];
  }
): Promise<Computation> => {
  const result = await Promise.all(
    value.map(async (el) => {
      if (el === null || typeof el !== "object") return el;
      if ("type" in el) {
        if (el.type === "Outlet") return { ...el, props: {} } as LayoutElement;

        const result = getConfigFromType(el.type, options.libraries);
        if (!result) {
          return undefined;
        }
        const library = el.type.split(":")[0];

        const [type, config] = result;

        const entries = await Promise.all(
          config.props.map(async ({ name, type }) => {
            const computation = compute.find(({ id }) =>
              id.match(new RegExp(`${el.id}\/${name}\#?`))
            )!;
            const result = await callback(computation);
            const value =
              type === "children" ? { $children: result } : result[0];
            return [name, value];
          })
        );

        const props = Object.fromEntries(entries);
        const newEl: LayoutElement = {
          ...el,
          type: library ? `${library}:${type}` : type,
          props,
        };
        return newEl;
      } else if ("fref" in el) {
        const entries = await Promise.all(
          compute
            .filter(({ id }) => id.startsWith(el.id))
            .map(async (el) => [el.id.split("/")[1], await callback(el)])
        );

        const args = Object.fromEntries(entries);
        const newEl: FieldImport = { ...el, args };
        return newEl;
      } else if ("id" in el && "filters" in el) {
        return { $fetch: await options.fetch(el) };
      } else if ("id" in el) {
        const entries = await Promise.all(
          compute
            .filter((el) => el.id.startsWith(el.id))
            .map(async (el) => [getTemplateFieldId(el.id), await callback(el)])
        );

        const values = Object.fromEntries(entries);
        const newEl: NestedDocument = { ...el, values };
        return newEl;
      } else {
        return el;
      }
    })
  );

  return result.reduce((a, c) => {
    if (c !== null && typeof c === "object" && "$fetch" in c) {
      a.push(...([["("], ...c.$fetch, [")"]] as Computation));
    } else if (c !== undefined) {
      a.push(c);
    }
    return a;
  }, [] as Computation);
};

export const calculateFlatComputationAsync = async (
  id: string,
  value: FlatComputation,
  compute: ComputationBlock[],
  options: {
    fetch: (fetcher: Fetcher) => Promise<NestedDocument[]>;
    libraries: LibraryConfig[];
  }
): Promise<Value[]> => {
  const computation = await traverseFlatComputationAsync(
    value,
    compute,
    async (block) => {
      if (!block) return [];
      return await calculateFlatComputationAsync(
        block.id,
        block.value,
        compute,
        options
      );
    },
    options
  );

  const getter = async (_id: string) => {
    const id = _id.indexOf(".") > 0 ? _id.split(".")[1] : _id;
    const computation = compute.find((el) => el.id === id)?.value;
    if (!computation) return [];
    return await calculateFlatComputationAsync(
      id,
      computation,
      compute,
      options
    );
  };

  return calculateAsync(id, computation, getter);
};

export const findFetchers = (
  value: FlatComputation,
  compute: ComputationBlock[]
) => {
  const results: Fetcher[] = [];
  const add = (value: FlatComputation | undefined) => {
    if (value) {
      results.push(...findFetchers(value, compute));
    }
  };
  const fetchers = value.filter((el): el is Fetcher => symb.isFetcher(el));
  const imports = value.filter((el): el is FieldImport =>
    symb.isImport(el, "field")
  );
  imports.forEach((imp) => {
    const comp = compute.find((el) => el.id === imp.fref)!;
    results.push(...findFetchers(comp.value, compute));
  });
  results.push(...fetchers);
  traverseFlatComputation(value, compute, (value) => add(value?.value));
  return results;
};
