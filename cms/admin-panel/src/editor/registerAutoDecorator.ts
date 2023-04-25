import { DecoratorNode, LexicalEditor } from "lexical";
import { TextNode } from "lexical";
import React from "react";

export type TextNodeWithOffset = {
  node: TextNode;
  offset: number;
};

export type EntityMatch = { end: number; start: number };

export function registerAutoDecorator<T extends DecoratorNode<React.ReactNode>>(
  editor: LexicalEditor,
  getMatch: (text: string) => null | EntityMatch,
  createNode: (textNode: TextNode) => T
): () => void {
  const textNodeTransform = (node: TextNode) => {
    if (!node.isSimpleText()) {
      return;
    }

    let text = node.getTextContent();
    let currentNode = node;
    let match;

    match = getMatch(text);

    if (match === null) {
      return;
    }

    let nodeToReplace;

    if (match.start === 0) {
      [nodeToReplace, currentNode] = currentNode.splitText(match.end);
    } else {
      [, nodeToReplace, currentNode] = currentNode.splitText(
        match.start,
        match.end
      );
    }

    const replacementNode = createNode(nodeToReplace);

    nodeToReplace.replace(replacementNode);

    /*
    if ($isDecoratorNode(replacementNode.getNextSibling())) {
      replacementNode.insertAfter($createTextNode(""));
    }
    if ($isDecoratorNode(replacementNode.getPreviousSibling())) {
      replacementNode.insertBefore($createTextNode(""));
    }
    */

    if (currentNode === null) {
      return;
    }
  };

  return editor.registerNodeTransform(TextNode, textNodeTransform);
}
