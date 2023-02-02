export const markdownToHTML = (string: string) => {
  const matches = string.matchAll(new RegExp(`^(\\*+)|[^\\\\](\\*+)`, "g"));

  let prev = 0;
  let bold = false;
  let italic = false;

  let result = "";

  const addText = (text: string) => {
    if (italic) {
      text = `<em>${text}</em>`;
    }
    if (bold) {
      text = `<strong>${text}</strong>`;
    }

    result += text;
  };

  for (let el of matches) {
    if (el.index === undefined) {
      continue;
    }
    let index = el.index + (el[1] ? 0 : 1);
    let value = el[1] || el[2];

    // text
    addText(string.slice(prev, index));

    const asterisks = value.length;

    if (asterisks === 3) {
      bold = !bold;
      italic = !italic;
    } else if (asterisks === 2) {
      bold = !bold;
    } else if (asterisks === 1) {
      italic = !italic;
    }

    prev = index + value.length;
  }

  addText(string.slice(prev));

  return result;
};

export const ParseRichText = ({ children }: { children: string }) => {
  return (
    <span dangerouslySetInnerHTML={{ __html: markdownToHTML(children) }} />
  );
};
