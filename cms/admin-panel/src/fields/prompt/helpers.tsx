export const markMatchingString = (
  string: string,
  query: string
): React.ReactNode => {
  let i = 0;
  let stringLower = string.toLowerCase();
  let queryLower = query.toLowerCase();
  while (stringLower[i] === queryLower[i]) {
    i++;
    if (i >= string.length || i >= query.length) {
      break;
    }
  }

  return i > 0 ? (
    <>
      <strong className="whitespace-pre">{string.substring(0, i)}</strong>
      <span className="whitespace-pre opacity-80">{string.substring(i)}</span>
    </>
  ) : (
    <span className="whitespace-pre">{string}</span>
  );
};
