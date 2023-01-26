export const staticParams = (array: string[]) => {
  const result = Object.fromEntries(
    array.map((el, index) => [`${index + 1}`, el])
  );
  return [result];
};
