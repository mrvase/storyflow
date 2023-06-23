import { FolderId, RawFieldId, ValueArray } from "@storyflow/shared/types";
import { parseDocument } from "./convert";
import { createObjectId } from "./mongo";
import { client } from "./mongo";
import { DBDocumentRaw } from "./types";

export const createFetcher =
  (dbName: string | undefined) =>
  async (fetchObject: {
    folder: FolderId;
    filters: Record<RawFieldId, ValueArray>;
    limit: number;
    sort?: string[];
  }) => {
    const filters = Object.fromEntries(
      Object.entries(fetchObject.filters ?? {})
        .filter(([, value]) => Array.isArray(value) && value.length > 0)
        .map(([key, value]) => {
          return [`values.${key}`, { $elemMatch: { $in: value } }];
        })
    );

    const sort = fetchObject.sort?.length
      ? Object.fromEntries(
          fetchObject.sort.map((el): [string, 1 | -1] => [
            `values.${el.slice(1)}`,
            el.slice(0, 1) === "+" ? 1 : -1,
          ])
        )
      : { _id: -1 as -1 };

    const db = await client.get(dbName);
    const result = await db
      .collection<DBDocumentRaw>("documents")
      .find({
        folder: createObjectId(fetchObject.folder),
        ...filters,
      })
      .sort(sort)
      .limit(fetchObject.limit)
      .toArray();

    return result.map(parseDocument);
  };
