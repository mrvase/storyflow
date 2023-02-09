import clientPromise from "./mongo/mongoClient";
import {
  FIELDS,
  computeFieldId,
  calculateFlatComputationAsync,
  findFetchers,
} from "@storyflow/backend";
import type {
  Computation,
  ComputationBlock,
  DBDocument,
  Fetcher,
  Filter,
  NestedDocument,
  TemplateFieldId,
} from "@storyflow/backend/types";
import type { LibraryConfig, RenderArray } from "@storyflow/frontend/types";
import { WithId } from "mongodb";
import { resolveProps } from "./props/resolveProps";

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

const defaultLibrary: LibraryConfig = {
  name: "",
  label: "Default",
  components: {
    Outlet: {
      label: "Outlet",
      name: "Outlet",
      props: [],
    },
    Link: {
      label: "Link",
      name: "Link",
      props: [
        { name: "href", type: "string", label: "URL" },
        { name: "label", type: "string", label: "Label" },
      ],
      inline: true,
    },
  },
};

export async function fetchSinglePage(
  url: string,
  db: string,
  clientLibraries: LibraryConfig[]
) {
  const libraries = [...clientLibraries, defaultLibrary];

  const client = await clientPromise;

  const regex = `^${url
    .split("/")
    .map((el, index) => (index === 0 ? el : `(${el}|\\*)`))
    .join("/")}$`;

  const doc = await client
    .db(db)
    .collection("articles")
    .findOne<DBDocument>({
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

  const getByPower = async (
    id: TemplateFieldId
  ): Promise<RenderArray | undefined> => {
    const fieldId = computeFieldId(doc.id, id);
    const computation = blocks.find((el) => el.id === fieldId)?.value;

    if (!computation) return [];

    const fetchers = findFetchers(computation, blocks);

    // caching
    fetchers.forEach((fetcher) => fetchFetcher(fetcher, db));

    const slug = db.split("-").slice(0, -1).join("-");

    return resolveProps(
      await calculateFlatComputationAsync(fieldId, computation, blocks, {
        fetch: (fetcher) => fetchFetcher(fetcher, db),
      }),
      {
        libraries,
        slug,
      },
      {
        index: 0,
      }
    );
  };

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
      ...(title && { title }),
    },
  };
}
