import type {
  DocumentId,
  FieldId,
  FolderId,
  NestedDocumentId,
  RawDocumentId,
  RawFieldId,
  RawFolderId,
} from "@storyflow/shared/types";

/*
Types

WorkspaceId: [string 1b]
RawDocumentId: [WorkspaceId 1b][string 5b]
DocumentId: [RawDocumentId 6b][RawDocumentId 6b]
ShortTemplateId: [string 2b] (b5 and b6 in RawDocumentId)
RawFieldId: [WorkspaceId 1b][ShortTemplateId 2b][string 3b]
FieldId: [RawDocumentId 6b][RawFieldId 6b]

*/

const ROOT_PARENT_NUMBER = 0;
export const ROOT_FOLDER_NUMBER = 1;
export const TEMPLATE_FOLDER_NUMBER = 2;
export const SYSTEM_TEMPLATE_OFFSET = 3;
export const SYSTEM_COMPOUND_TEMPLATE_OFFSET = 128;
export const USER_TEMPLATE_OFFSET = 256;
export const USER_DOCUMENT_OFFSET = 256 ** 2;

const WORKSPACE_ID = "00"; // 1b
const NULL_TEMPLATE_ID = "0000"; // 2b

const ROOT_PARENT_RAW = `${WORKSPACE_ID}${toHex(ROOT_PARENT_NUMBER, "5b")}`;

/*

Dokumenter
00 00 00 00 00 00 ubrugt (ingen forælder / ingen template)
00 00 00 00 00 01 - 00 00 00 00 00 FF bruges af systemet
-> 00 00 00 00 00 01 root folder
-> 00 00 00 00 00 02 template folder
00 00 00 00 01 00 - 00 00 00 00 FF FF bruges til templates
00 00 00 01 00 00 - FF FF FF FF FF FF bruges til dokumenter
*/

export function isTemplateDocument(id: DocumentId) {
  return parseInt(getRawDocumentId(id), 16) < USER_DOCUMENT_OFFSET - 1;
}

function toHex(number: number, length: `${number}b`) {
  const no = parseInt(length, 10);
  if (no < 1 || no > 6) {
    throw new Error("Invalid length");
  } else if (number > 256 ** no) {
    throw new Error(`Number too large: ${number}`);
  }
  return number.toString(16).padStart(no * 2, "0");
}

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

export function getRawFieldId(id: FieldId) {
  if (id.length !== 24) {
    throw new Error(`Invalid field id: ${id}`);
  }
  return id.slice(12, 24) as RawFieldId;
}

export function createDocumentId(number: number): DocumentId;
export function createDocumentId(
  number: number,
  parent: DocumentId
): NestedDocumentId;
export function createDocumentId(
  number: number,
  parent?: DocumentId
): DocumentId | NestedDocumentId {
  const first = parent ? getRawDocumentId(parent) : ROOT_PARENT_RAW;
  const last = `${WORKSPACE_ID}${toHex(number, "5b")}`;

  return `${first}${last}` as DocumentId | NestedDocumentId;
}

export const getWorkspaceId = (id: DocumentId | NestedDocumentId) => {
  return getRawDocumentId(id).slice(0, 2);
};

export const createFieldId = (number: number, documentId: DocumentId) => {
  const hex = toHex(number, "3b");

  return [
    getRawDocumentId(documentId),
    WORKSPACE_ID,
    NULL_TEMPLATE_ID,
    hex,
  ].join("") as FieldId;
};

export const getFieldNumber = (id: FieldId | RawFieldId) => {
  return parseInt(id.slice(-6), 16);
};

export const getFolderNumber = (id: FolderId) => {
  return parseInt(id.slice(-12), 16);
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

export const getDocumentId = <
  T extends DocumentId | NestedDocumentId = DocumentId | NestedDocumentId
>(
  id: FieldId
): T => {
  if (id.length !== 24) {
    throw new Error(`Invalid field id: ${id}`);
  }
  return `${WORKSPACE_ID}${toHex(0, "5b")}${id.slice(0, 12)}` as T;
};

export const normalizeDocumentId = (
  id: RawDocumentId | DocumentId | NestedDocumentId
) => {
  if (id.length === 12) {
    return `${ROOT_PARENT_RAW}${id}` as DocumentId;
  }
  if (id.length !== 24) {
    throw new Error(`Invalid field id: ${id}`);
  }
  return id as DocumentId;
};

export const normalizeFolderId = (id: RawFolderId | FolderId): FolderId => {
  if (id.length === 12) {
    return `${ROOT_PARENT_RAW}${id}` as FolderId;
  }
  if (id.length !== 24) {
    throw new Error(`Invalid field id: ${id}`);
  }
  return id as FolderId;
};

export const getParentDocumentId = (id: NestedDocumentId): DocumentId => {
  if (id.length !== 24) {
    throw new Error(`Invalid field id: ${id}`);
  }

  return `${WORKSPACE_ID}${toHex(0, "5b")}${id.slice(0, 12)}` as DocumentId;
};

export const computeShortTemplateId = (id: DocumentId) => {
  return getRawDocumentId(id).slice(8, 12);
};

export const getTemplateDocumentId = (id: RawFieldId | FieldId) => {
  if (![12, 24].includes(id.length)) {
    throw new Error(`Invalid field id: ${id}`);
  }

  const shortId = id.length === 24 ? id.slice(14, 18) : id.slice(2, 6);

  if (shortId === NULL_TEMPLATE_ID && id.length === 24) {
    return getDocumentId(id as FieldId) as DocumentId;
  }

  return `${ROOT_PARENT_RAW}${shortId.padStart(12, "0")}` as DocumentId;
};

export const isTemplateField = (id: FieldId) => {
  return getTemplateDocumentId(id) !== getDocumentId(id);
};

export const isCustomFolder = (id: FolderId) => {
  return getFolderNumber(id) < 256 ** 2;
};

export const createRawTemplateFieldId = (fieldId: FieldId) => {
  if (isTemplateField(fieldId)) {
    return getRawFieldId(fieldId);
  }

  const fieldDocumentId = getDocumentId(fieldId) as DocumentId;
  const fieldWorkspaceId = getWorkspaceId(fieldDocumentId);
  const shortTemplateId = computeShortTemplateId(fieldDocumentId);
  const hex = fieldId.slice(18, 24);

  return [
    fieldWorkspaceId, // 1b
    shortTemplateId, // 2b
    hex, // 3b
  ].join("") as RawFieldId;
};

export const createTemplateFieldId = (
  documentId: DocumentId | NestedDocumentId,
  fieldId: FieldId
) => {
  if (isTemplateField(fieldId)) {
    return replaceDocumentId(fieldId, documentId);
  }

  return computeFieldId(documentId, createRawTemplateFieldId(fieldId));
};

export function revertTemplateFieldId(fieldId: FieldId | RawFieldId) {
  const documentId = getTemplateDocumentId(fieldId);
  /*
  const number = parseInt(documentId.slice(1), 16);
  if (number < 256 && fieldId.length === 24) {
    if (overwritingTemplate) {
      return replaceDocumentId(fieldId as FieldId, overwritingTemplate);
    }
    return fieldId as FieldId;
  }
  */
  return createFieldId(getFieldNumber(fieldId), documentId);
}

export const isNestedDocumentId = (
  id: DocumentId | NestedDocumentId
): id is NestedDocumentId => {
  return id.slice(0, 12) !== ROOT_PARENT_RAW;
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
  if (typeof result[1] !== "number") result[1] = 0;

  numbers.forEach((el, i) => {
    if (i % 2) {
      result[0] += (16777216 - el) % 1876429;
      result[1] += (el * (1 + 1000 * (i + 3))) & 0xffffff;
    } else {
      result[1] += (16777216 - el) % 1876429;
      result[0] += (el * (1 + 1000 * (i + 3))) & 0xffffff;
    }
  });

  return `${toHex(result[1] & 0xffffff, "3b")}${toHex(
    result[0] & 0xffffff,
    "3b"
  )}` as RawFieldId;
};
