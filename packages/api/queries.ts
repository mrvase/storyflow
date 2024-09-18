import { FolderId, RawFieldId, ValueArray } from "@storyflow/shared/types";
import { parseDocument } from "./convert";
import { createObjectId } from "./mongo";
import { client } from "./mongo";
import { DBDocumentRaw } from "./types";
import {
  createRawTemplateFieldId,
  createTemplateFieldId,
} from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { modifyKeys, modifyObject } from "./utils";
import { DBDocument } from "@storyflow/cms/types";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { tokens } from "@storyflow/cms/tokens";
import { createSharedFieldCalculator } from "@storyflow/cms/get-field-record";

const getNamespacesQuery = (namespaces?: string[]) =>
  namespaces &&
  namespaces.length > 0 && {
    folder: {
      $in: namespaces.map((el) => createObjectId(`${el}`.padStart(24, "0"))),
    },
  };

const urlDbProp = `values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`;
const releasedDbProp = `values.${createRawTemplateFieldId(
  DEFAULT_FIELDS.released.id
)}`;
const publishedDbProp = `values.${createRawTemplateFieldId(
  DEFAULT_FIELDS.published.id
)}`;

const publishedQuery = {
  [releasedDbProp]: { $not: { $gt: new Date() } },
  [publishedDbProp]: { $ne: false },
};

export const findDocumentByUrl = async ({
  dbName,
  url,
  namespaces,
}: {
  dbName?: string;
  url: string;
  namespaces?: string[];
}) => {
  const db = await client.get(dbName);

  const regex = `^${url
    .split("/")
    .map((el, index) => (index === 0 ? el : `(${el}|\\*)`))
    .join("/")}$`;

  const docRaw = await db.collection("documents").findOne<DBDocumentRaw>({
    ...getNamespacesQuery(namespaces),
    ...publishedQuery,
    [urlDbProp]:
      url.indexOf("/") < 0
        ? url
        : {
            $regex: regex,
          },
  });

  if (!docRaw) {
    return null;
  }

  const doc = parseDocument(docRaw);

  return doc;
};

export type Fetcher = (
  fetchObject: {
    folder: FolderId;
    filters?: Record<RawFieldId, ValueArray>;
    limit?: number;
    sort?: Record<RawFieldId, 1 | -1>;
    offset?: number;
  },
  options?: {
    filterUnpublished?: boolean;
  }
) => Promise<DBDocument[]>;

export const createFetcher = (dbName: string | undefined) => {
  const fetcher: Fetcher = async (fetchObject, options = {}) => {
    let filters: object = {};

    if (fetchObject.filters) {
      filters = modifyObject(fetchObject.filters, ([key, value]) => {
        if (!Array.isArray(value) || value.length === 0) return;
        return [`values.${key}`, { $elemMatch: { $in: value } }];
      });
    }

    const sort = fetchObject.sort
      ? modifyKeys(fetchObject.sort, (el) => `values.${el}`)
      : { _id: -1 as -1 };

    const db = await client.get(dbName);

    let cursor = db
      .collection<DBDocumentRaw>("documents")
      .find({
        folder: createObjectId(fetchObject.folder),
        ...filters,
        ...(options.filterUnpublished ? publishedQuery : {}),
      })
      .sort(sort);

    if (fetchObject.offset) {
      const skip = fetchObject.offset * (fetchObject.limit ?? 1);
      cursor = cursor.skip(skip);
    }

    if (fetchObject.limit) {
      cursor = cursor.limit(fetchObject.limit);
    }

    const result = (await cursor.toArray()).map(parseDocument);

    return result;
  };
  return fetcher;
};

export async function getPaths(
  namespaces?: string[],
  dbName?: string,
  filter?: (doc: DBDocumentRaw, index: number, all: DBDocumentRaw[]) => boolean
) {
  const db = await client.get(dbName);
  const fetcher = createFetcher(dbName);

  let docs = await db
    .collection<DBDocumentRaw>("documents")
    .find({
      ...(namespaces && namespaces?.length > 0
        ? getNamespacesQuery(namespaces)
        : {
            [urlDbProp]: {
              $exists: true,
            },
          }),
    })
    .toArray();

  if (filter) {
    docs = docs.filter(filter);
  }

  const urls = docs
    .map((el) => {
      const doc = parseDocument(el);
      return {
        _id: doc._id,
        url: el.values[
          createRawTemplateFieldId(DEFAULT_FIELDS.url.id)
        ][0] as string,
        record: doc.record,
      };
    })
    .sort((a, b) => {
      if (a.url.length < b.url.length) {
        return -1;
      }
      if (a.url.length > b.url.length) {
        return 1;
      }
      return 0;
    });

  if (!fetcher) {
    return urls.map((el) =>
      el.url
        .split("/")
        .map((el, index) => (el === "*" ? `[${index}]` : el))
        .join("/")
    );
  }

  const dynamicUrls = urls.filter((el) => el.url.indexOf("*") > 0);
  const ordinaryUrls = urls.filter((el) => el.url.indexOf("*") < 0);

  const staticUrls = (
    await Promise.all(
      dynamicUrls.map(async ({ _id, url, record }) => {
        const paramsFieldId = createTemplateFieldId(
          _id,
          DEFAULT_FIELDS.params.id
        );

        // it might not exist yet
        const tree = record[paramsFieldId] ?? DEFAULT_SYNTAX_TREE;

        const toUrl = (slug: string) => `${url.slice(0, -1)}${slug}`;

        const children = tree.children.filter((el) => !tokens.isLineBreak(el));

        if (children.every((el): el is string => typeof el === "string")) {
          return children.map(toUrl);
        }

        // wrap in select
        record[paramsFieldId] = {
          type: "select",
          children: [
            {
              type: "fetch",
              children: [tree],
              data: [150],
            },
          ],
          data: createRawTemplateFieldId(DEFAULT_FIELDS.slug.id),
        };

        const calculateField = createSharedFieldCalculator(record, {}, fetcher);

        const slugs = (await calculateField(paramsFieldId))?.entry ?? [];

        if (!Array.isArray(slugs)) {
          throw new Error("Slugs cannot rely on client state");
        }

        if (slugs.every((el): el is string => typeof el === "string")) {
          return slugs.map(toUrl);
        }

        return [];
      })
    )
  ).flat(1);

  return [...ordinaryUrls.map((el) => el.url), ...staticUrls];
}
