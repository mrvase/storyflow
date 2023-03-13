import type {
  BrandedObjectId,
  DocumentId,
  FieldId,
  FolderId,
  NestedDocumentId,
  RawDocumentId,
  RawFieldId,
  RawFolderId,
} from "./types";

/*
WorkspaceId: [string 1b]
RawDocumentId: [WorkspaceId 1b][string 5b]
DocumentId: [RawDocumentId 6b][RawDocumentId 6b]
ShortTemplateId: [string 2b] (b5 and b6 in RawDocumentId)
RawFieldId: [WorkspaceId 1b][ShortTemplateId 2b][string 3b]
FieldId: [RawDocumentId 6b][RawFieldId 6b]
*/

export const getRawDocumentId = (id: DocumentId | NestedDocumentId) => {
  if (id.length !== 24) {
    throw new Error(`Invalid document id: ${id}`);
  }
  return id.slice(12, 24) as RawDocumentId;
};

export const getRawFolderId = (id: FolderId) => {
  if (id.length !== 24) {
    throw new Error(`Invalid document id: ${id}`);
  }
  return id.slice(12, 24) as RawFolderId;
};

export const getRawFieldId = (id: FieldId) => {
  if (id.length !== 24) {
    throw new Error(`Invalid field id: ${id}`);
  }
  return id.slice(12, 24) as RawFieldId;
};

const toHex = (number: number, length: `${number}b`) => {
  const no = parseInt(length, 10);
  if (no < 1 || no > 6) {
    throw new Error("Invalid length");
  } else if (number > 256 ** no) {
    throw new Error("Number too large");
  }
  return number.toString(16).padStart(no * 2, "0");
};

const WORKSPACE_ID = `0`;

const NULL_TEMPLATE_ID = `00`;

const ROOT_PARENT = `${WORKSPACE_ID}${toHex(0, "5b")}`;

export function createDocumentId(number: number): DocumentId;
export function createDocumentId(
  number: number,
  parent: DocumentId
): NestedDocumentId;
export function createDocumentId(
  number: number,
  parent?: DocumentId
): DocumentId | NestedDocumentId {
  const first = parent ? getRawDocumentId(parent) : ROOT_PARENT;
  const last = `${WORKSPACE_ID}${toHex(number, "5b")}`;

  return `${first}${last}` as DocumentId | NestedDocumentId;
}

export const getWorkspaceId = (id: DocumentId) => {
  return getRawDocumentId(id).slice(0, 1);
};

export const createFieldId = (
  number: number,
  documentId: DocumentId,
  templateDocumentId?: DocumentId
) => {
  const hex = toHex(number, "3b");

  if (templateDocumentId) {
    return [
      getRawDocumentId(documentId), // 6b
      getWorkspaceId(templateDocumentId), // 1b
      computeShortTemplateId(templateDocumentId), // 2b
      hex, // 3b
    ].join("") as FieldId;
  }
  return [
    getRawDocumentId(documentId),
    WORKSPACE_ID,
    NULL_TEMPLATE_ID,
    hex,
  ].join("") as FieldId;
};

export const replaceDocumentId = (
  id: FieldId,
  newDocumentId: DocumentId | NestedDocumentId
) => {
  return `${getRawDocumentId(newDocumentId)}${getRawFieldId(id)}` as FieldId;
};

export const computeFieldId = (
  documentId: DocumentId | NestedDocumentId,
  rawFieldId: RawFieldId
) => {
  if (rawFieldId.length !== 12) {
    throw new Error(`Invalid raw field id: ${rawFieldId}`);
  }
  return `${getRawDocumentId(documentId)}${rawFieldId}` as FieldId;
};

export const getDocumentId = (id: FieldId) => {
  if (id.length !== 24) {
    throw new Error(`Invalid field id: ${id}`);
  }
  return `${WORKSPACE_ID}${toHex(0, "5b")}${id.slice(0, 12)}` as
    | DocumentId
    | NestedDocumentId;
};

export const computeShortTemplateId = (id: DocumentId) => {
  return getRawDocumentId(id).slice(8, 12);
};

export const getTemplateDocumentId = (id: RawFieldId | FieldId) => {
  if (id.length === 12) {
    return `${ROOT_PARENT}${id.slice(2, 6).padStart(12, "0")}` as DocumentId;
  }
  if (id.length === 24) {
    return `${ROOT_PARENT}${id.slice(14, 18).padStart(12, "0")}` as DocumentId;
  }
  throw new Error(`Invalid field id: ${id}`);
};

export const isTemplateField = (id: FieldId) => {
  return getTemplateDocumentId(id).endsWith("0000");
};

export const unwrapObjectId = <T>(id: BrandedObjectId<T>): T => {
  return id.toHexString() as T;
};

export const isNestedDocumentId = (
  id: DocumentId | NestedDocumentId
): id is NestedDocumentId => {
  return id.slice(0, 12) !== ROOT_PARENT;
};

export const isFieldOfDocument = (
  id: FieldId,
  documentId: DocumentId | NestedDocumentId
) => {
  const fieldDocument = getDocumentId(id);
  return getRawDocumentId(fieldDocument) === getRawDocumentId(documentId);
};

const radix = 27;

export const getIdFromString = (string: string): RawFieldId => {
  // The maximum possible return value is 27 + 27*27 + 27*27^2 + 27*27^3 + 27*27^4=14900787.
  // This is lower than what can be contained in the corresponding three bits: 257^3=16777216.

  string = string.toLowerCase();
  const numbers: number[] = [];

  const add = (number: number) => {
    if (i % 5 === 0) {
      numbers.unshift(number);
    } else {
      numbers[0] = numbers[0] * radix + number;
    }
    i++;
  };

  let i = 0;
  let skip = 0;

  while (i < string.length) {
    let el = string[i + skip];
    if (el === "_" || el === "$") {
      add(25); // overlaps with z
    } else if (el === "#") {
      add(26);
    } else {
      let int = parseInt(el, 36); // 0 - 25
      if (Number.isNaN(int)) {
        skip++;
        continue;
      }
      add((int >= 10 ? int - 10 : int) + 1);
    }
  }

  numbers.reverse();

  const result = numbers.splice(0, 2);
  result[1] ??= 0;

  numbers.forEach((el, i) => {
    if (i % 2) {
      result[0] += (16777216 - el) % 1876429;
      result[1] += (el * (1 + 1000 * (i + 3))) & 0xffffff;
    } else {
      result[1] += (16777216 - el) % 1876429;
      result[0] += (el * (1 + 1000 * (i + 3))) & 0xffffff;
    }
  });

  return `${toHex(result[1], "3b")}${toHex(result[0], "3b")}` as RawFieldId;
};
