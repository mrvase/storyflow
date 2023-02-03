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
import type { LibraryConfig } from "@storyflow/frontend/types";
import { getConfigByType } from "./traverse-helpers/getConfigByType";
import { createRenderArray } from "./traverse-helpers/createRenderArray";

const BUCKET_NAME = "awss3stack-mybucket15d133bf-1wx5fzxzweii4";
const BUCKET_REGION = "eu-west-1";

const getImageObject = (name: string, slug: string) => {
  const url = `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${slug}/${name}`;

  const width = name ? parseInt(name.split("-")[1] ?? "0", 10) : 0;
  const height = name ? parseInt(name.split("-")[2] ?? "0", 10) : 0;

  return {
    url,
    width,
    height,
  };
};

export const traverseFlatComputationAsync = async (
  value: FlatComputation,
  compute: ComputationBlock[],
  callback: (block: ComputationBlock | undefined) => Promise<any>,
  options: {
    fetch: (fetcher: Fetcher) => Promise<NestedDocument[]>;
    libraries: LibraryConfig[];
    slug: string;
  }
): Promise<Computation> => {
  const result = await Promise.all(
    value.map(async (el) => {
      if (el === null || typeof el !== "object") return el;
      if ("type" in el) {
        const config = getConfigByType(el.type, options.libraries);

        if (!config) {
          return undefined;
        }

        const entries = await Promise.all(
          config.props.map(async ({ name, type }) => {
            const computation = compute.find(({ id }) =>
              id.match(new RegExp(`${el.id}\/${name}\#?`))
            )!;
            const result = await callback(computation);
            let value = result[0];
            if (type === "children") {
              value = {
                $children: createRenderArray(result, options.libraries),
              };
            } else if (type === "image") {
              if (Array.isArray(result[0])) {
                value = getImageObject(result[0][0] as string, options.slug);
              } else {
                value = { url: "", width: 0, height: 0 };
              }
            }
            return [name, value];
          })
        );

        const props = Object.fromEntries(entries);

        const newEl: LayoutElement = {
          ...el,
          type: config.name, // replaces name with "library:key"
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
    slug: string;
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
