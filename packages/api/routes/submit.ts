import { createFieldRecordGetter } from "@storyflow/cms/get-field-record";
import { getUrlParams } from "../convert";
import { createFetcher, findDocumentByUrl } from "../create-fetcher";
import { createTemplateFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import {
  FieldId,
  FolderId,
  RawFieldId,
  ValueArray,
} from "@storyflow/shared/types";
import util from "util";
import { createDocumentIdGenerator } from "./documents";
import { client, createObjectId } from "../mongo";
import { DBDocumentRaw, DBValueRecord } from "../types";
import { RPCError } from "@nanorpc/server";

export const submit = async ({
  url,
  namespaces,
  dbName,
  action,
  id,
  data,
}: {
  url: string;
  id: string;
  action: string;
  data: Record<string, string[]>;
  namespaces?: string[];
  dbName?: string;
}) => {
  const doc = await findDocumentByUrl({
    url,
    namespaces,
    dbName,
  });

  if (!doc) {
    return new RPCError({
      code: "NOT_FOUND",
      status: 404,
      message: "No server action found [1]",
    });
  }

  const params = getUrlParams(url);

  const getFieldRecord = createFieldRecordGetter(
    doc.record,
    { ...params, ...data },
    createFetcher(dbName),
    {
      createActions: true,
    }
  );

  const pageRecord = await getFieldRecord(
    createTemplateFieldId(doc._id, DEFAULT_FIELDS.page.id)
  );

  if (!pageRecord) {
    return new RPCError({
      code: "NOT_FOUND",
      status: 404,
      message: "No server action found [2]",
    });
  }

  const db = await client.get(dbName);

  const actionValue = pageRecord.record[action as FieldId];

  if (!action || !Array.isArray(actionValue) || action.length === 0) {
    return new RPCError({
      code: "NOT_FOUND",
      status: 404,
      message: "No server action found [3]",
    });
  }

  const inserts = (actionValue as any[]).filter(
    (
      el
    ): el is {
      values: DBValueRecord;
      action: "insert";
      folder: FolderId;
    } => typeof el === "object" && el !== null && el.action === "insert"
  );

  if (!inserts.length) {
    return new RPCError({
      code: "NOT_FOUND",
      status: 404,
      message: "No server action found [4]",
    });
  }

  const generateDocumentId = createDocumentIdGenerator(db, inserts.length);

  const docs = await Promise.all(
    inserts.map(async ({ folder, values }): Promise<DBDocumentRaw> => {
      const documentId = await generateDocumentId();

      const timestamp = Date.now();

      const updated = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, timestamp])
      );

      return {
        _id: createObjectId(documentId),
        folder: createObjectId(folder),
        values,
        fields: [],
        config: [],
        versions: { config: [0] },
        updated,
        cached: [],
      };
    })
  );

  const result1 = await db
    .collection<DBDocumentRaw>("documents")
    .insertMany(docs);

  return result1.acknowledged;
};
