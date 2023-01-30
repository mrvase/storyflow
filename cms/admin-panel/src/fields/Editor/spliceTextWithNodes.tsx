import { LexicalNode, TextNode } from "lexical";

export const spliceTextWithNodes = (
  node: TextNode,
  index: number,
  deleteCount: number,
  nodes: LexicalNode[]
) => {
  if (nodes.length === 0) {
    throw new Error("No nodes");
  }

  const [last, ...rest] = nodes.slice().reverse();
  if (!node.isSimpleText()) {
    return;
  }

  if (index >= node.getTextContent().length) {
    node.insertAfter(last);
  } else if (index === 0) {
    if (deleteCount === 0) {
      node.insertBefore(last);
    } else {
      const [replace, nodeAfter] = node.splitText(deleteCount);
      replace.replace(last);
    }
  } else {
    if (deleteCount === 0) {
      const [, nodeAfter] = node.splitText(index);
      nodeAfter.insertBefore(last);
    } else {
      const [, replace, nodeAfter] = node.splitText(index, index + deleteCount);
      replace.replace(last);
    }
  }

  rest.reduce((a, c) => {
    a.insertBefore(c);
    return c;
  }, last);

  last.selectNext(0, 0);
};
