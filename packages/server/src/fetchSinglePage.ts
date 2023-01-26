import {
  LAYOUT_ID,
  PAGE_ID,
  REDIRECT_ID,
  URL_ID,
} from "@storyflow/backend/templates";
import {
  Computation,
  ComputationBlock,
  DBDocument,
  Fetcher,
  FieldId,
  Filter,
  NestedDocument,
  TemplateFieldId,
} from "@storyflow/backend/types";
import clientPromise from "./mongo/mongoClient";
import { WithId } from "mongodb";
import { computeFieldId } from "@storyflow/backend/ids";
import {
  calculateFlatComputationAsync,
  findFetchers,
} from "@storyflow/backend/traverse-async";
import { LibraryConfig } from "@storyflow/frontend/types";

let CACHE: Record<string, Promise<NestedDocument[]>> = {};

function fetchFetcher(fetcher: Fetcher, db: string): Promise<NestedDocument[]> {
  const fetch = async () => {
    const client = await clientPromise;

    const isFetcherFetchable = (
      fetcher: Fetcher
    ): fetcher is Fetcher & {
      filters: {
        field: Exclude<Filter["field"], "">;
        operation: Exclude<Filter["operation"], "">;
        value: Computation;
      }[];
    } => {
      return (
        fetcher.filters.length > 0 &&
        fetcher.filters.every(
          (el: Filter) =>
            el.value.length > 0 &&
            ![el.field, el.operation].some((el: any) =>
              ["", null, undefined].includes(el)
            )
        )
      );
    };

    if (!isFetcherFetchable(fetcher)) {
      return [];
    }

    const filters = fetcher.filters.reduce(
      (
        acc,
        filter: {
          field: Exclude<Filter["field"], "">;
          operation: Exclude<Filter["operation"], "">;
          value: Computation;
        }
      ) => {
        const operator = {
          "=": "eq",
          ">": "gt",
          "<": "lt",
          ">=": "gte",
          "<=": "lte",
        };
        const field =
          filter.field === "folder" ? "folder" : `values.${filter.field}`;
        acc[field] = {
          [`$${operator[filter.operation]}`]:
            filter.value.length === 1 ? filter.value[0] : filter.value,
        };
        return acc;
      },
      {} as Record<string, { [key: string]: any }>
    );

    const result = await client
      .db(db)
      .collection("articles")
      .find<WithId<DBDocument>>(filters)
      .sort({ _id: -1 })
      .toArray();

    return result.map((el) => ({
      id: el.id,
      values: el.values,
    }));
  };

  return (
    CACHE[JSON.stringify(fetcher)] ?? (CACHE[JSON.stringify(fetcher)] = fetch())
  );
}

export async function fetchSinglePage(
  url: string,
  db: string,
  libraries: LibraryConfig[]
) {
  const client = await clientPromise;

  const regex = `^${url
    .split("/")
    .map((el, index) => (index === 0 ? el : `(${el}|\\*)`))
    .join("/")}$`;

  const doc = await client
    .db(db)
    .collection("articles")
    .findOne<DBDocument>({
      [`values.${URL_ID}`]:
        url.indexOf("/") < 0
          ? url
          : {
              $regex: regex,
            },
    });

  if (!doc) {
    return null;
  }

  const blocks: ComputationBlock[] = [
    ...doc.compute,
    ...(Object.entries(doc.values).map(([key, value]) => ({
      id: computeFieldId(doc.id, key as TemplateFieldId),
      value,
    })) as ComputationBlock[]),
  ];

  const getByPower = async (
    id: TemplateFieldId
  ): Promise<Computation | undefined> => {
    const fieldId = computeFieldId(doc.id, id);
    const computation = blocks.find((el) => el.id === fieldId)?.value;

    if (!computation) return [];

    const fetchers = findFetchers(computation, blocks);

    // caching
    fetchers.forEach((fetcher) => fetchFetcher(fetcher, db));

    return await calculateFlatComputationAsync(fieldId, computation, blocks, {
      fetch: (fetcher) => fetchFetcher(fetcher, db),
      libraries,
    });
  };

  const [layout, redirect, page] = await Promise.all([
    getByPower(LAYOUT_ID),
    getByPower(REDIRECT_ID),
    getByPower(PAGE_ID),
  ]);

  return {
    layout: layout ?? null,
    page: page ?? null,
  };
}