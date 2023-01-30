import { DocumentId, FieldId, TemplateFieldId } from "./types";

export const createFieldId = (
  documentId: DocumentId,
  templateDocumentId?: DocumentId
) => {
  return `${documentId}${templateDocumentId ?? documentId}${createId(
    2
  )}` as FieldId;
};

export const isDocumentId = (
  id: DocumentId | TemplateFieldId | FieldId
): id is DocumentId => {
  return id.length === 4;
};

export const replaceDocumentId = (id: FieldId, newDocumentId: DocumentId) => {
  return `${newDocumentId}${id.slice(4)}` as FieldId;
};

export const computeFieldId = (
  documentId: DocumentId,
  templateFieldId: TemplateFieldId
) => {
  return `${documentId}${templateFieldId}` as FieldId;
};

export const getTemplateFieldId = (id: FieldId) => {
  return id.slice(4) as TemplateFieldId;
};

export const getDocumentId = (id: FieldId | TemplateFieldId) => {
  return id.slice(0, 4) as DocumentId;
};

export const getTemplateDocumentId = (id: FieldId) => {
  return id.slice(4, 8) as DocumentId;
};

export const isTemplateField = (id: FieldId) => {
  return getDocumentId(id) !== getTemplateDocumentId(id);
};

const chars16 = "0123456789abcdef";
const chars64 =
  "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
// const chars64 ="-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".slice("");

type CharMap = Record<string, string>;

const getHexCharMaps = () => {
  return Array.from<number>({ length: 4096 }).reduce(
    (acc, _, index) => {
      const hex = `${chars16[Math.floor(index / (16 * 16)) % 16]}${
        chars16[Math.floor(index / 16) % 16]
      }${chars16[index % 16]}`;
      const char = `${chars64[Math.floor(index / 64) % 64]}${
        chars64[index % 64]
      }`;
      acc[0][hex] = char;
      acc[1][char] = hex;
      return acc;
    },
    [{}, {}] as [CharMap, CharMap]
  );
};

const getNumberHexMap = () => {
  return Array.from<number>({ length: 256 }).reduce((acc, _, index) => {
    const hex = `${chars16[Math.floor(index / 16) % 16]}${chars16[index % 16]}`;
    acc[index] = hex;
    return acc;
  }, {} as CharMap);
};

const [hexToChar, charToHex] = getHexCharMaps();
const numberToHex = getNumberHexMap();

export const createIdFromNumber = (number: number) => {
  // Vi skal bruge 0 <= number < 65536
  // og dette svarer til "number % 65536"
  number &= 0xffffff;
  // "number >> 8" svarer til "Math.floor(number / 256)""
  // "number & 0xff" svarer til "number % 255"
  const a = (number >> 16) & 0xff;
  const b = (number >> 8) & 0xff;
  const c = number & 0xff;
  const hex = `${numberToHex[a]}${numberToHex[b]}${numberToHex[c]}`;
  return minimizeId(hex);
};

export const createId = (length = 2) => {
  const createFourDigitId = () => {
    const number = Math.floor(Math.random() * 16777215);
    return createIdFromNumber(number);
  };
  return Array.from({ length }, () => createFourDigitId()).join("");
};

const split = (id: string, size = 3) => {
  const length = Math.ceil(id.length / size);
  return Array.from({ length }, (_, x) =>
    id.substring(size * x, size * (x + 1))
  );
};

const getConverter = (map: CharMap) => {
  const size = Object.keys(map)[0].length;
  return (id: string) =>
    split(id, size)
      .map((el) => map[el])
      .join("");
};

export const minimizeId = getConverter(hexToChar);
export const restoreId = getConverter(charToHex);
