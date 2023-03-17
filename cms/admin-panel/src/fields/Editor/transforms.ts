import {
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  ElementNode,
  LexicalNode,
  $isNodeSelection,
  $isRangeSelection,
  NodeSelection,
  RangeSelection,
  $createParagraphNode,
  $createLineBreakNode,
  $createTextNode,
  $isParagraphNode,
  $isRootNode,
} from "lexical";
import type { GridSelection, PointType } from "lexical/LexicalSelection";
import {
  $createDocumentNode,
  $isDocumentNode,
} from "../decorators/DocumentNode";
import {
  $createFunctionNode,
  $isFunctionNode,
} from "../decorators/FunctionNode";
import { $createImportNode, $isImportNode } from "../decorators/ImportNode";
import {
  $createInlineLayoutElementNode,
  $isInlineLayoutElementNode,
} from "../decorators/InlineLayoutElementNode";
import {
  $createLayoutElementNode,
  $isLayoutElementNode,
} from "../decorators/LayoutElementNode";
import {
  $createOperatorNode,
  $isOperatorNode,
} from "../decorators/OperatorNode";
import {
  $createParameterNode,
  $isParameterNode,
} from "../decorators/ParameterNode";
import { $createTokenNode, $isTokenNode } from "../decorators/TokenNode";
import {
  $createHeadingNode,
  $isHeadingNode,
} from "../../editor/react/HeadingNode";
import { tools } from "shared/editor-tools";
import {
  matchNonEscapedCharacter,
  splitByNonEscapedCharacter,
} from "shared/matchNonEscapedCharacter";
import { TokenStream, NestedElement } from "@storyflow/backend/types";
import { LibraryConfig } from "@storyflow/frontend/types";
import { getConfigFromType } from "../../client-config";
import { $createContextNode, $isContextNode } from "../decorators/ContextNode";
import { $createFolderNode, $isFolderNode } from "../decorators/FolderNode";
import { tokens } from "@storyflow/backend/tokens";
import { isSymbol } from "@storyflow/backend/symbols";

export const isInlineElement = (
  libraries: LibraryConfig[],
  element: NestedElement
): boolean => {
  const config = getConfigFromType(element.element, libraries);
  const result = Boolean(config?.inline);
  return result;
};

export const $isBlockNode = (node: LexicalNode | null | undefined) =>
  $isHeadingNode(node) || $isParagraphNode(node);

export const $isSymbolNode = (node: LexicalNode) => {
  return (
    $isImportNode(node) ||
    $isOperatorNode(node) ||
    $isFunctionNode(node) ||
    $isParameterNode(node) ||
    $isContextNode(node) ||
    $isLayoutElementNode(node) ||
    $isInlineLayoutElementNode(node) ||
    $isDocumentNode(node) ||
    $isFolderNode(node) ||
    $isTokenNode(node)
  );
};

export const $getTextContent = (node: LexicalNode, endAt?: string) => {
  const recursivelyGetTextContent = (
    node: LexicalNode,
    textContent = ""
  ): { content: string; ended: boolean } => {
    if (node.__key === endAt) {
      return { content: "", ended: true };
    }
    if ($isElementNode(node)) {
      const children = node.getChildren?.();
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.__key === endAt) {
            return { content: textContent, ended: true };
          }
          if (i > 0 && $isBlockNode(child) && $isBlockNode(children[i - 1])) {
            textContent += "\n";
          }
          if ($isHeadingNode(child)) {
            const level = parseInt(child.__tag.slice(1), 10);
            textContent += "#".repeat(level) + " ";
          }
          const { content, ended } = recursivelyGetTextContent(
            child,
            textContent
          );
          if (ended) {
            return {
              ended: true,
              content,
            };
          }
          textContent = content;
        }
      }
    } else if ($isTextNode(node)) {
      let content = node.getTextContent();
      const stars = matchNonEscapedCharacter(textContent, "\\*+$")?.[0]?.value
        ?.length;
      const formerIsItalic = stars === 1 || stars === 3;
      const formerIsBold = stars === 2 || stars === 3;
      if (node.hasFormat("bold")) {
        if (formerIsBold) {
          textContent = textContent.slice(0, -2);
        } else {
          content = `**${content}`;
        }
        content = `${content}**`;
      }
      if (node.hasFormat("italic")) {
        if (formerIsItalic) {
          textContent = textContent.slice(0, -1);
        } else {
          content = `*${content}`;
        }
        content = `${content}*`;
      }
      textContent += content;
    } else if ($isLineBreakNode(node)) {
      textContent += "\n";
    } else if ($isSymbolNode(node)) {
      textContent += node.getTextContent();
    }
    return {
      content: textContent,
      ended: false,
    };
  };

  let { content } = recursivelyGetTextContent(node);

  return content;
};

export const $getComputation = (node: LexicalNode) => {
  const recursivelyGetContent = (
    node: LexicalNode,
    prevContent: TokenStream = []
  ) => {
    let content: TokenStream = [];
    if ($isElementNode(node)) {
      const children = node.getChildren?.();
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (i > 0 && $isBlockNode(child) && $isBlockNode(children[i - 1])) {
            content = tools.concat(content, [{ n: true }]);
          }
          if ($isHeadingNode(child)) {
            const level = parseInt(child.__tag.slice(1), 10);
            content = tools.concat(content, [`${"#".repeat(level)} `]);
          }
          const newContent = recursivelyGetContent(child, content);
          content = tools.concat(content, newContent);
        }
      }
    } else if ($isTextNode(node)) {
      let text = node.getTextContent();
      let last = prevContent[prevContent.length - 1];
      if (typeof last === "string") {
        const stars = matchNonEscapedCharacter(last, "\\*+$")?.[0]?.value
          ?.length;
        const formerIsItalic = stars === 1 || stars === 3;
        const formerIsBold = stars === 2 || stars === 3;
        if (node.hasFormat("bold")) {
          if (formerIsBold) {
            last = last.slice(0, -2);
          } else {
            text = `**${text}`;
          }
          text = `${text}**`;
        }
        if (node.hasFormat("italic")) {
          if (formerIsItalic) {
            last = last.slice(0, -2);
          } else {
            text = `*${text}`;
          }
          text = `${text}*`;
        }
        prevContent[prevContent.length - 1] = last;
      } else {
        if (node.hasFormat("bold")) {
          text = `**${text}**`;
        }
        if (node.hasFormat("italic")) {
          text = `*${text}*`;
        }
      }
      content = [text];
    } else if ($isLineBreakNode(node)) {
      content = ["\n"];
    } else if ($isImportNode(node)) {
      content = [node.__value];
    } else if ($isOperatorNode(node)) {
      const operator = node.getTextContent();
      let compute: TokenStream = [];
      if (operator === ",") {
        compute = [{ ",": true }];
      } else if (operator === "(") {
        compute = [{ "(": true }];
      } else if (operator === ")") {
        compute = [{ ")": true }];
      } else if (operator === "[") {
        compute = [{ "[": true }];
      } else if (operator === "]") {
        compute = [{ "]": true }];
      } else {
        compute = [{ _: operator as "+" }];
      }
      content = compute;
    } else if ($isFunctionNode(node)) {
      content = [{ "(": node.__func }];
    } else if ($isParameterNode(node)) {
      const parameter = node.getTextContent();
      content = [{ x: parseInt(parameter, 10) }];
    } else if ($isLayoutElementNode(node)) {
      content = [node.__value];
    } else if ($isInlineLayoutElementNode(node)) {
      content = [node.__value];
    } else if ($isDocumentNode(node)) {
      content = [node.__value];
    } else if ($isFolderNode(node)) {
      content = [node.__value];
    } else if ($isContextNode(node)) {
      content = [node.__value];
    } else if ($isTokenNode(node)) {
      content = [node.__value];
    }
    return content;
  };

  let content = recursivelyGetContent(node);

  return content;
};

/*
const getTextContent = (editor: LexicalEditor) => {
  return editor.getEditorState().read(() => $getTextContent($getRoot()));
};
*/

export const $getIndexFromPoint = (anchor: PointType): number => {
  if (anchor.type === "text") {
    const textBefore = $getTextContent($getRoot(), anchor.key).length;
    return textBefore + anchor.offset;
  } else {
    let parentNode = anchor.getNode();
    let node = parentNode?.getChildAtIndex?.(anchor.offset) ?? parentNode; // if the paragraph is selected with anchor on decorator node
    const textBefore = $getTextContent($getRoot(), node.__key).length;
    // node === parentNode => node === paragraphNode, and we are positioned at the end of the paragraph after a decorator node
    const textInside = node === parentNode ? $getTextContent(node).length : 0;
    return textBefore + textInside;
  }
};

const $getIndexFromNodeSelection = (
  selection: NodeSelection,
  includeNodes = true
): number => {
  const nodes = selection.getNodes();
  const textBefore = $getTextContent($getRoot(), nodes[0].__key).length;
  if (!includeNodes) return textBefore;
  const textInside = nodes.map((el) => $getTextContent(el)).join("").length;
  return textBefore + textInside;
};

export const $isSelection = (
  selection: unknown
): selection is RangeSelection | NodeSelection =>
  $isRangeSelection(selection) || $isNodeSelection(selection);

export const $getIndexesFromSelection = (
  selection: RangeSelection | NodeSelection
) => {
  if ($isRangeSelection(selection)) {
    return [
      $getIndexFromPoint(selection.anchor),
      $getIndexFromPoint(selection.focus),
    ];
  } else if ($isNodeSelection(selection)) {
    return [
      $getIndexFromNodeSelection(selection, false),
      $getIndexFromNodeSelection(selection, true),
    ];
  }
  return [0, 0];
};

/**
 * IMPORTANT CAVEAT!
 * for the string "abc", index = 0 represents both:
 * - the symbol at index 0: [a]bc
 * - the starting cursor position: |abc
 * if we have something of the format "abc{import node}"
 * the same node is not returned for index = 3:
 * - the symbol is an import node
 * - the cursor is at the end of the text node with content = "abc".
 * Therefore we need to specify the parameter "prioritize".
 */

export const $getNodeFromIndex = (
  prioritize: "symbol" | "cursor",
  index: number,
  startElement: ElementNode,
  startIndex: number = 0
): [node: LexicalNode | null, index: number] => {
  let i = startIndex;
  let cursorIndex = i;
  let cursorNode: LexicalNode | null = null;
  let symbolNode: LexicalNode | null = null;
  for (let child of startElement.getChildren()) {
    cursorIndex = i;
    if ($isElementNode(child)) {
      let nodeCandidate;
      [nodeCandidate, i] = $getNodeFromIndex(prioritize, index, child, i);
      if (nodeCandidate !== null) {
        cursorNode = nodeCandidate;
        symbolNode = nodeCandidate;
      }
    } else if ($isTextNode(child)) {
      const length = $getTextContent(child).length;
      if (i + length === index) {
        cursorNode = child;
      }
      if (i + length > index) {
        cursorNode = child;
      }
      i += length;
    } else if ($isLineBreakNode(child)) {
      i += 1;
    } else if ($isSymbolNode(child)) {
      if (i === index) {
        symbolNode = child;
      }
      i += 1;
    }
    if (i > index) {
      break;
    }
  }

  const node =
    prioritize === "symbol"
      ? symbolNode ?? cursorNode
      : cursorNode ?? symbolNode;

  return [node, node === symbolNode ? 0 : cursorIndex];
};

export const $getPointFromIndex = (
  prioritize: "symbol" | "cursor",
  index: number
): [node: LexicalNode | null, offset: number] => {
  const [node, i] = $getNodeFromIndex(prioritize, index, $getRoot());
  return [node, index - i];
};

export const getNodesFromComputation = (
  compute: TokenStream,
  libraries: LibraryConfig[]
) => {
  let bold = false;
  let italic = false;
  let skip = 0;
  return compute.reduce((acc: LexicalNode[], el, index) => {
    if (skip > 0) {
      skip--;
      return acc;
    }
    if (typeof el === "string" || typeof el === "number") {
      splitByNonEscapedCharacter(`${el}`, "\\n").forEach((text) => {
        if (text === "\n") {
          const node = $createLineBreakNode();
          acc.push(node);
        } else {
          splitByNonEscapedCharacter(`${text}`, "\\*+").forEach((text) => {
            if (text === "***") {
              bold = !bold;
              italic = !italic;
            } else if (text === "**") {
              bold = !bold;
            } else if (text === "*") {
              italic = !italic;
            } else {
              const node = $createTextNode(text);
              if (bold) {
                node.toggleFormat("bold");
              }
              if (italic) {
                node.toggleFormat("italic");
              }
              acc.push(node);
            }
          });
        }
      });
    } else if (typeof el === "boolean") {
      const node = $createTextNode(el ? "SAND" : "FALSK");
      acc.push(node);
    } else if (isSymbol(el, "(") && typeof el["("] === "string") {
      const node = $createFunctionNode((el as any)[1]);
      acc.push(node);
    } else if (tokens.isNestedField(el)) {
      const node = $createImportNode(el);
      acc.push(node);
    } else if (tokens.isParameter(el)) {
      const node = $createParameterNode(`${el["x"]}`);
      acc.push(node);
    } else if (tokens.isNestedElement(el)) {
      if (isInlineElement(libraries, el)) {
        const node = $createInlineLayoutElementNode(el);
        acc.push(node);
      } else {
        const node = $createLayoutElementNode(el);
        acc.push(node);
      }
    } else if (tokens.isNestedDocument(el)) {
      const node = $createDocumentNode(el);
      acc.push(node);
    } else if (tokens.isNestedFolder(el)) {
      const node = $createFolderNode(el);
      acc.push(node);
    } else if (
      tokens.isFileToken(el) ||
      tokens.isColorToken(el) ||
      tokens.isCustomToken(el)
    ) {
      const node = $createTokenNode(el);
      acc.push(node);
    } else if (tokens.isContextToken(el)) {
      const node = $createContextNode(el);
      acc.push(node);
    } else if (isSymbol(el, "_")) {
      const node = $createOperatorNode(el["_"]);
      acc.push(node);
    } else if (
      isSymbol(el, ",") ||
      isSymbol(el, "(") ||
      isSymbol(el, ")") ||
      isSymbol(el, "[") ||
      isSymbol(el, "]")
    ) {
      const key = Object.keys(el)[0];
      const node = $createOperatorNode(key);
      acc.push(node);
    }
    return acc;
  }, []);
};

export function $getBlocksFromComputation(
  initialState: TokenStream,
  libraries: LibraryConfig[]
) {
  const blocks: LexicalNode[] = [];

  const isBlockElement = (el: TokenStream[number]) => {
    return (
      (tokens.isNestedElement(el) && !isInlineElement(libraries, el)) ||
      tokens.isNestedDocument(el) ||
      tokens.isNestedFolder(el) ||
      tokens.isNestedFolder(el)
    );
  };

  const arrSplit = tools.split(
    initialState,
    (el) => tokens.isLineBreak(el) || isBlockElement(el)
  );

  const arr = arrSplit
    // we need to do this filter before the other one since the other one needs
    // to check both the current and next element
    .filter((el) => el.length > 0)
    .filter(
      (el, index, arr) =>
        // strings create paragraphs themselves
        !tokens.isLineBreak(el[0]) ||
        index === arr.length - 1 ||
        tokens.isLineBreak(arr[index + 1]?.[0])
    );

  if (!arr.length) {
    const paragraphNode = $createParagraphNode();
    blocks.push(paragraphNode);
    return blocks;
  }

  arr.forEach((computation) => {
    if (computation.length === 1 && isBlockElement(computation[0])) {
      if (tokens.isNestedElement(computation[0])) {
        blocks.push($createLayoutElementNode(computation[0]));
      } else if (tokens.isNestedFolder(computation[0])) {
        blocks.push($createFolderNode(computation[0] as any));
      } else {
        blocks.push($createDocumentNode(computation[0] as any));
      }
    } else if (tokens.isLineBreak(computation[0])) {
      const paragraphNode = $createParagraphNode();
      blocks.push(paragraphNode);
    } else {
      const isHeading: false | string =
        typeof computation[0] === "string" &&
        (computation[0].match(/^(\#+)\s/)?.[1] ?? false);
      const paragraphNode = isHeading
        ? $createHeadingNode(`h${isHeading.length}` as "h1")
        : $createParagraphNode();
      computation = isHeading
        ? tools.slice(computation, 1 + isHeading.length)
        : computation;
      const nodes = getNodesFromComputation(computation, libraries);
      paragraphNode.append(...nodes);
      blocks.push(paragraphNode);
    }
  });

  return blocks;
}

export function $initializeEditor(
  initialState: TokenStream,
  libraries: LibraryConfig[]
): void {
  const root = $getRoot();

  if (root.isEmpty()) {
    const blocks = $getBlocksFromComputation(initialState, libraries);
    root.append(...blocks);
  }
}

export function $clearEditor() {
  const root = $getRoot();
  root.clear();
}

export function $getLastBlock(
  selection: RangeSelection | NodeSelection | GridSelection,
  libraries: LibraryConfig[]
) {
  const nodes = selection.getNodes();
  if (nodes.length === 0) return;
  let lastNode: LexicalNode | null = nodes[nodes.length - 1];
  if ($isRootNode(lastNode)) {
    return lastNode;
  }
  while (
    lastNode &&
    !$isParagraphNode(lastNode) &&
    !$isHeadingNode(lastNode) &&
    !(
      $isLayoutElementNode(lastNode) &&
      !isInlineElement(libraries, lastNode.__value)
    ) &&
    !$isDocumentNode(lastNode)
  ) {
    lastNode = lastNode!.getParent();
  }
  return lastNode;
}
