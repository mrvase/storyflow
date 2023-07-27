import { FolderId, RawFieldId, ValueArray } from "@storyflow/shared/types";
import { parseDocument } from "./convert";
import { createObjectId } from "./mongo";
import { client } from "./mongo";
import { DBDocumentRaw } from "./types";
import { createRawTemplateFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { modifyKeys, modifyObject } from "./utils";

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
    ...(namespaces &&
      namespaces.length > 0 && {
        folder: {
          $in: namespaces.map((el) =>
            createObjectId(`${el}`.padStart(24, "0"))
          ),
        },
      }),
    [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]:
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

export const createFetcher =
  (dbName: string | undefined) =>
  async (fetchObject: {
    folder: FolderId;
    filters?: Record<RawFieldId, ValueArray>;
    limit?: number;
    sort?: Record<RawFieldId, 1 | -1>;
    offset?: number;
  }) => {
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
