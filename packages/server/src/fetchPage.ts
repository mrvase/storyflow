import clientPromise from "./mongo/mongoClient";
/*
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
} from "@storyflow/backend/types";
import {
  calculateFlatComputationAsync,
  findFetchers,
} from "@storyflow/backend/traverse-async";
import { WithId } from "mongodb";

async function fetchSinglePage(url: string, db: string) {
  const client = await clientPromise;

  console.time("DOCUMENT");
  const article = await client
    .db(db)
    .collection("articles")
    .findOne<DBDocument>({
      [`values.${URL_ID}`]:
        url.indexOf("/") < 0
          ? url
          : {
              $regex: `^${url
                .split("/")
                .map((el, index) => (index === 0 ? el : `(${el}|\\*)`))
                .join("/")}$`,
            },
    });
  console.timeEnd("DOCUMENT");

  if (!article) {
    return null;
  }

  return article;
}

let CACHE: Record<string, Promise<NestedDocument[]>> = {};

function fetchFetcher(fetcher: Fetcher): Promise<NestedDocument[]> {
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

    const id = Math.random().toString(36).slice(2, 10);
    console.time(`FETCHER-${id}`);
    const result = await client
      .db("semper-4ljs")
      .collection("articles")
      .find<WithId<DBDocument>>(filters)
      .sort({ _id: -1 })
      .toArray();
    console.timeEnd(`FETCHER-${id}`);

    return result.map((el) => ({
      id: el.id,
      values: el.values,
    }));
  };

  return (
    CACHE[JSON.stringify(fetcher)] ?? (CACHE[JSON.stringify(fetcher)] = fetch())
  );
}

export async function fetchPage(url: string, db: string) {
  const slugs = url === "" ? [""] : [""].concat(url.split("/"));

  console.time("e");
  const pages = await Promise.all(
    slugs.map((_, i, arr) => {
      const path = arr.slice(1, i + 1).join("/");
      return fetchSinglePage(path, db).then(async (doc) => {
        if (!doc) return null;

        const blocks: ComputationBlock[] = [
          ...doc.fields,
          ...(Object.entries(doc.values).map(([key, value]) => ({
            id: `${doc.id}${key}`,
            value,
          })) as ComputationBlock[]),
        ];

        const getByPower = async (
          id: string
        ): Promise<Computation | undefined> => {
          const fieldId = `${doc.id}${id}` as FieldId;
          const computation = blocks.find((el) => el.id === fieldId)?.value;
          if (!computation) return [];

          const fetchers = findFetchers(computation, blocks);

          // caching
          fetchers.forEach((fetcher) => fetchFetcher(fetcher));

          return await calculateFlatComputationAsync(
            fieldId,
            computation,
            blocks,
            {
              fetch: fetchFetcher,
              libraries: [],
              slug: "",
            }
          );
        };

        const [layout, redirect, page] = await Promise.all([
          getByPower(LAYOUT_ID),
          getByPower(REDIRECT_ID),
          i === arr.length - 1 ? getByPower(PAGE_ID) : undefined,
        ]);

        return {
          id: doc.id,
          path,
          redirect: redirect?.[0] ?? null,
          layout: layout ?? null,
          ...(i === arr.length - 1 && {
            page: page ?? null,
          }),
        };
      });
    })
  );
  console.timeEnd("e");

  CACHE = {};

  return pages.reverse();
}
*/
