import type { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import type { DocumentId, RawFieldId } from "@storyflow/shared/types";
import { computeFieldId } from "@storyflow/fields-core/ids";
import { parseSyntaxStream } from "./parse-syntax-stream";
import type { DBDocument, DBDocumentRaw, DBId } from "./types";

export const unwrapObjectId = <T>(id: DBId<T>): T => {
  if (typeof id === "string") return id;
  return id.toHexString() as T;
};

export const getSyntaxTreeRecord = (
  documentId: DocumentId,
  doc: Pick<DBDocumentRaw, "fields" | "values">
): SyntaxTreeRecord => {
  const fields = Object.fromEntries(
    doc.fields.map(({ k, v }) => [unwrapObjectId(k), parseSyntaxStream(v)])
  );
  Object.entries(doc.values).forEach(([id, value]) => {
    const fieldId = computeFieldId(documentId, id as RawFieldId);
    if (!(fieldId in fields)) {
      fields[fieldId] = parseSyntaxStream(value);
    }
  });
  return fields;
};

export const parseDocument = (raw: DBDocumentRaw): DBDocument => {
  const { _id, folder, ids, cached, fields, ...rest } = raw;
  const id = unwrapObjectId(raw._id);
  return {
    _id: id,
    folder: unwrapObjectId(raw.folder),
    record: getSyntaxTreeRecord(id, raw),
    ...rest,
  };
};
