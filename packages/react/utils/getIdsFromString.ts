const radix = 27;

function toHex(number: number, length: `${number}b`) {
  const no = parseInt(length, 10);
  if (no < 1 || no > 6) {
    throw new Error("Invalid length");
  } else if (number > 256 ** no) {
    throw new Error(`Number too large: ${number}`);
  }
  return number.toString(16).padStart(no * 2, "0");
}

export const getIdFromString = (string: string): string => {
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

  return `${toHex(result[1] & 0xffffff, "3b")}${toHex(
    result[0] & 0xffffff,
    "3b"
  )}`;
};
