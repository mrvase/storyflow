import type { DocumentId, FieldId, TemplateFieldId } from "./types";

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

const stringToId = (string: string) => {
  // - case-insensitive
  // - 0-9 are treated as a-j
  // - $ and _ are both treated as z
  // - # is treated on its own
  // - rest of symbols are ignored

  // we end up with 27 characters. That means 5 characters can be encoded in 3 bits.

  const array = string
    .toLowerCase()
    .split("")
    .filter((el) => el.match(/[0-9a-z$_#]/));

  const groups = Math.ceil(array.length / 5);
  const numbers = [0, 0];

  // The maximum possible return value is 27 + 27*27 + 27*27^2 + 27*27^3 + 27*27^4=14900787.
  // This is lower than what can be contained in the corresponding three bits: 257^3=16777216.
  const radix = 27;

  let nextOffset = 0;

  for (let i = 0; i < groups; i++) {
    let group = array.splice(0, 5);

    if (group.length === 0) {
      // nothing to be added
      return;
    }

    let number = group
      .map((el, index) => {
        let int;
        if (el === "_" || el === "$") {
          int = 25; // overlaps with z
        } else if (el === "#") {
          int = 26;
        } else {
          int = parseInt(el, 36); // 0 - 25
          int = int >= 10 ? int - 10 : int;
        }
        let base = radix ** index;
        // Adds 1 to make sure 0/a are different from nothing.
        // This adjusts the range to 1-27
        return (int + 1) * base;
      })
      .reduce((a, c) => a + c);

    // we produce the offset on the basis of the above
    // calculation in isolation. We then add the former offset afterwards.
    // This means that the group is only entangled with
    // the previous one, creating entanglement across
    // the two numbers.

    const newOffset = (16777216 - number) % 1876429;
    // ^^ takes what is missing up to the maximum bit value but
    //    makes sure it is no higher than the difference between
    //    the maximum bit value and the maximum possible return value.

    number += nextOffset;
    nextOffset = newOffset; // (256^3 - number) % (256^3 - (27 + 27*27 + 27*27^2 + 27*27^3 + 27*27^4))

    // we do this so that the position of the group
    // has significance as well.
    // this ensures that aaaaabbbbbccccc !== cccccbbbbbaaaaa.
    // Nothing happens to the first and second group.
    // This ensures that character combinations below 10 chars
    // are truly unique. After this, uniqueness is lost anyway.
    number *= 1 + 1000 * Math.floor(i / 2);

    numbers[Number(i % 2)] += number;
  }

  const toHex = (n: number) => (n & 0xffffff).toString(16).padStart(6, "0");
  // svarer til % 16777216

  return numbers.map(toHex).join("");
};
