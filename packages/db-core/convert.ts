import type { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import type { DocumentId, RawFieldId } from "@storyflow/shared/types";
import { computeFieldId } from "@storyflow/fields-core/ids";
import { parseSyntaxStream } from "./parse-syntax-stream";
import type { DBDocumentRaw, DBId } from "./types";

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
