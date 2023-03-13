import clientPromise from "./mongo/mongoClient";
import { computeFieldId } from "@storyflow/backend/ids";
import { FIELDS } from "@storyflow/backend/fields";
import {
  calculateFlatComputationAsync,
  findFetchers,
} from "@storyflow/backend/traverse-async";
import type {
  Computation,
  ComputationBlock,
  DBDocument,
  NestedDocument,
  Value,
} from "@storyflow/backend/types";
import type { FetchPageResult, LibraryConfig } from "@storyflow/frontend/types";
import { WithId } from "mongodb";

let CACHE: Record<string, Promise<NestedDocument[]>> = {};

const BUCKET_NAME = "awss3stack-mybucket15d133bf-1wx5fzxzweii4";
const BUCKET_REGION = "eu-west-1";

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
          "!=": "ne",
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
      .collection("documents")
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
  namespaces: string[],
  db: string
): Promise<FetchPageResult | null> {
  const client = await clientPromise;

  const regex = `^${url
    .split("/")
    .map((el, index) => (index === 0 ? el : `(${el}|\\*)`))
    .join("/")}$`;

  const doc = await client
    .db(db)
    .collection("documents")
    .findOne<DBDocument>({
      ...(namespaces.length > 0 && {
        folder: { $in: namespaces },
      }),
      [`values.${FIELDS.url.id}`]:
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

  const slug = db.split("-").slice(0, -1).join("-");

  const getByPower = async (id: TemplateFieldId): Promise<Value[]> => {
    const fieldId = computeFieldId(doc.id, id);
    const computation = blocks.find((el) => el.id === fieldId)?.value;

    if (!computation) return [];

    const fetchers = findFetchers(computation, blocks);

    // caching
    fetchers.forEach((fetcher) => fetchFetcher(fetcher, db));

    const content = await calculateFlatComputationAsync(
      fieldId,
      computation,
      blocks,
      {
        fetch: (fetcher) => fetchFetcher(fetcher, db),
      }
    );

    return content;
  };

  const imageUrl = `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${slug}`;

  const [layout, redirect, page, title] = await Promise.all([
    getByPower(FIELDS.layout.id),
    getByPower(FIELDS.redirect.id),
    getByPower(FIELDS.page.id),
    getByPower(FIELDS.label.id),
  ]);

  return {
    layout: layout ?? null,
    page: page ?? null,
    head: {
      ...(isType(title, "string") && { title: title[0] }),
    },
    imageUrl,
  };
}

type Type = {
  string: string;
  number: number;
  boolean: boolean;
  date: Date;
  object: Record<string, any>;
  array: any[];
};

const isType = <T extends keyof Type>(
  el: any,
  type: T
): el is [Type[T], ...any] => Array.isArray(el) && typeof el[0] === type;
