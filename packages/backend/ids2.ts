import type { DocumentId, FieldId, TemplateFieldId } from "./types";
import { RawDocumentId } from "./types2";

const getRawId = (id: DocumentId) => {
  return id.slice(12, 24) as RawDocumentId;
};

const toHex = (number: number, length: "3b" | "6b" = "6b") => {
  return number.toString(16).padStart(length === "6b" ? 12 : 6, "0");
};

export const createDocumentId = (number: number, parent?: DocumentId) => {
  return `${parent ? getRawId(parent) : "000000000000"}${toHex(
    number
  )}` as DocumentId;
};

export const getWorkspaceId = (id: DocumentId) => {
  return getRawId(id).slice(0, 1);
};

export const createFieldId = (
  number: number,
  documentId: DocumentId,
  templateDocumentId?: DocumentId
) => {
  const hex = toHex(number, "3b");

  if (templateDocumentId) {
    return [
      getRawId(documentId), // 6b
      getWorkspaceId(templateDocumentId), // 1b
      getRawId(templateDocumentId).slice(8, 12), // 2b
      hex, // 3b
    ].join("") as FieldId;
  }
  return [getRawId(documentId), "0", "00", hex].join("") as FieldId;
};

export const replaceDocumentId = (id: FieldId, newDocumentId: DocumentId) => {
  return `${getRawId(newDocumentId)}${getTemplateFieldId(id)}` as FieldId;
};

export const computeFieldId = (
  documentId: DocumentId,
  templateFieldId: TemplateFieldId
) => {
  return `${documentId}${templateFieldId}` as FieldId;
};

export const getTemplateFieldId = (id: FieldId) => {
  return id.slice(12, 24) as TemplateFieldId;
};

export const getDocumentId = (id: FieldId) => {
  return `000000000000${id.slice(0, 12)}` as DocumentId;
};

export const getTemplateDocumentId = (id: FieldId) => {
  return `00000000000000000000${id.slice(13, 17)}`;
};

export const isTemplateField = (id: FieldId) => {
  return getTemplateDocumentId(id).endsWith("0000");
};
