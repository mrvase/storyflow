export const matchNonEscapedCharacter = (string: string, pattern: string) => {
  return Array.from(
    string.matchAll(new RegExp(`^(${pattern})|[^\\\\](${pattern})`, "g")),
    (el) => {
      if (el.index === undefined) {
        return null;
      }
      if (el[1]) {
        return {
          index: el.index,
          value: el[1],
        };
      } else if (el[2]) {
        return {
          index: el.index + 1, // move index past character matched by: [^\\\\]
          value: el[2],
        };
      }
      return null;
    }
  ).filter((el): el is Exclude<typeof el, null> => el !== null);
};

export const replaceNonEscapedCharacter = (
  string: string,
  pattern: string,
  newValue: string
) => {
  const matches = matchNonEscapedCharacter(string, pattern);
  let newString = string;
  matches.reverse().forEach((el) => {
    newString =
      newString.slice(0, el.index) +
      newValue +
      newString.slice(el.index + el.value.length);
  });
  return newString;
};

export const splitByNonEscapedCharacter = (string: string, pattern: string) => {
  const matches = matchNonEscapedCharacter(string, pattern);
  let array: string[] = [];
  let prev = 0;
  matches.forEach((el) => {
    array.push(string.slice(prev, el.index));
    array.push(string.slice(el.index, el.index + el.value.length));
    prev = el.index + el.value.length;
  });
  array.push(string.slice(prev, string.length));
  return array;
};
