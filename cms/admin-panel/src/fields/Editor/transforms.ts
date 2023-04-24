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
  $setSelection,
  $createNodeSelection,
  ParagraphNode,
  LexicalEditor,
} from "lexical";
import { GridSelection, PointType } from "lexical/LexicalSelection";
import { tools } from "shared/editor-tools";
import {
  matchNonEscapedCharacter,
  splitByNonEscapedCharacter,
} from "shared/matchNonEscapedCharacter";
import { TokenStream, NestedElement } from "@storyflow/backend/types";
import { LibraryConfig } from "@storyflow/frontend/types";
import { getConfigFromType } from "../../client-config";
import { tokens } from "@storyflow/backend/tokens";
import { isSymbol } from "@storyflow/backend/symbols";

import {
  $createHeadingNode,
  $isHeadingNode,
  HeadingNode,
} from "../../editor/react/HeadingNode";
import {
  $createDocumentNode,
  $isDocumentNode,
} from "./decorators/DocumentNode";
import { $createFunctionNode } from "./decorators/FunctionNode";
import { $createImportNode } from "./decorators/ImportNode";
import { $createInlineLayoutElementNode } from "./decorators/InlineLayoutElementNode";
import {
  $createLayoutElementNode,
  $isLayoutElementNode,
} from "./decorators/LayoutElementNode";
import { $createOperatorNode } from "./decorators/OperatorNode";
import { $createParameterNode } from "./decorators/ParameterNode";
import { $createCustomTokenNode } from "./decorators/CustomTokenNode";
import { $createContextNode } from "./decorators/ContextNode";
import { $createFolderNode } from "./decorators/FolderNode";
import { $createCreatorNode } from "./decorators/CreatorNode";
import { $isPromptNode } from "./decorators/PromptNode";
import { $isTokenStreamNode } from "./decorators/TokenStreamNode";
import { $createFileNode } from "./decorators/FileNode";
import { $createColorNode } from "./decorators/ColorNode";
import { $createCommaNode } from "./decorators/CommaNode";
import { $createBracketNode } from "./decorators/BracketNode";

export const isInlineElement = (
  libraries: LibraryConfig[],
  element: NestedElement
): element is typeof element & { inline: true } => {
  const config = getConfigFromType(element.element, libraries);
  const result = Boolean(config?.inline);
  return result;
};

export const $isTextBlockNode = (
  node: LexicalNode | null | undefined
): node is ParagraphNode | HeadingNode =>
  $isHeadingNode(node) || $isParagraphNode(node);

const $getTextContent = (node: LexicalNode, endAt?: string) => {
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
          if (
            i > 0 &&
            $isTextBlockNode(child) &&
            $isTextBlockNode(children[i - 1])
          ) {
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
    } else if ($isPromptNode(node)) {
      // do nothing
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
    } else if ($isTokenStreamNode(node)) {
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

export const $getComputation = (node: LexicalNode, endAt?: string) => {
  const recursivelyGetContent = (
    node: LexicalNode,
    prevContent: TokenStream = []
  ): { content: TokenStream; ended: boolean } => {
    if (node.__key === endAt) {
      return { content: [], ended: true };
    }
    let content: TokenStream = [];
    if ($isElementNode(node)) {
      const children = node.getChildren?.();
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.__key === endAt) {
            return { content, ended: true };
          }
          if (
            i > 0 &&
            $isTextBlockNode(child) &&
            $isTextBlockNode(children[i - 1])
          ) {
            content = tools.concat(content, [{ n: true }]);
          }
          if ($isHeadingNode(child)) {
            const level = parseInt(child.__tag.slice(1), 10);
            content = tools.concat(content, [`${"#".repeat(level)} `]);
          }
          const { content: newContent, ended } = recursivelyGetContent(
            child,
            content
          );
          if (ended) {
            return {
              ended: true,
              content,
            };
          }
          content = tools.concat(content, newContent);
        }
      }
    } else if ($isPromptNode(node)) {
      content = node.getTokenStream();
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
    } else if ($isTokenStreamNode(node)) {
      content = node.getTokenStream();
    }
    return { content, ended: false };
  };

  let { content } = recursivelyGetContent(node);

  return content;
};

export const $getContentLength = (node: LexicalNode, endAt?: string) => {
  return $getTextContent(node, endAt).length;
};

/*
const getTextContent = (editor: LexicalEditor) => {
  return editor.getEditorState().read(() => $getTextContent($getRoot()));
};
*/

export const $getIndexFromPoint = (anchor: PointType): number => {
  if (anchor.type === "text") {
    const textBefore = $getContentLength($getRoot(), anchor.key);
    return textBefore + anchor.offset;
  } else {
    let parentNode = anchor.getNode();
    let node = parentNode?.getChildAtIndex?.(anchor.offset) ?? parentNode; // if the paragraph is selected with anchor on decorator node
    const textBefore = $getContentLength($getRoot(), node.__key);
    // node === parentNode => node === paragraphNode, and we are positioned at the end of the paragraph after a decorator node
    const textInside = node === parentNode ? $getContentLength(node) : 0;
    return textBefore + textInside;
  }
};

const $getIndexFromNodeSelection = (
  selection: NodeSelection,
  includeNodes = true
): number => {
  const nodes = selection.getNodes();
  const textBefore = $getContentLength($getRoot(), nodes[0].__key);
  if (!includeNodes) return textBefore;
  const textInside = nodes
    .map((el) => $getContentLength(el))
    .reduce((a, b) => a + b, 0);
  return textBefore + textInside;
};

export const $getStartAndEnd = (
  selection: RangeSelection
): [PointType, PointType] => {
  const anchor = selection.anchor;
  const focus = selection.focus;

  const isBefore = selection.isCollapsed() || anchor.isBefore(focus);
  const startPoint = isBefore ? anchor : focus;
  const endPoint = isBefore ? focus : anchor;

  return [startPoint, endPoint];
};

export const $isSelection = (
  selection: unknown
): selection is RangeSelection | NodeSelection =>
  $isRangeSelection(selection) || $isNodeSelection(selection);

export const $getIndexesFromSelection = (
  selection: RangeSelection | NodeSelection
): [number, number] => {
  if ($isRangeSelection(selection)) {
    return $getStartAndEnd(selection).map((s) => $getIndexFromPoint(s)) as [
      number,
      number
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
      const length = $getContentLength(child);
      if (i + length === index) {
        cursorNode = child;
      }
      if (i + length > index) {
        cursorNode = child;
      }
      i += length;
    } else if ($isLineBreakNode(child)) {
      i += 1;
    } else if ($isTokenStreamNode(child)) {
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

export const $createInlinesFromStream = (
  stream: TokenStream,
  libraries: LibraryConfig[]
) => {
  let bold = false;
  let italic = false;
  let skip = 0;
  return stream.reduce((acc: LexicalNode[], el, index) => {
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
    } else if (tokens.isNestedField(el)) {
      const node = $createImportNode(el);
      acc.push(node);
    } else if (tokens.isParameter(el)) {
      const node = $createParameterNode(el);
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
    } else if (tokens.isNestedCreator(el)) {
      const node = $createCreatorNode(el);
      acc.push(node);
    } else if (tokens.isNestedFolder(el)) {
      const node = $createFolderNode(el);
      acc.push(node);
    } else if (tokens.isFileToken(el)) {
      const node = $createFileNode(el);
      acc.push(node);
    } else if (tokens.isColorToken(el)) {
      const node = $createColorNode(el);
      acc.push(node);
    } else if (tokens.isCustomToken(el)) {
      const node = $createCustomTokenNode(el);
      acc.push(node);
    } else if (tokens.isContextToken(el)) {
      const node = $createContextNode(el);
      acc.push(node);
    } else if (isSymbol(el, "_")) {
      const node = $createOperatorNode(el);
      acc.push(node);
    } else if (isSymbol(el, ",")) {
      const node = $createCommaNode(el);
      acc.push(node);
    } else if (isSymbol(el, ")") && typeof el[")"] === "string") {
      const node = $createFunctionNode((el as any)[1]);
      acc.push(node);
    } else if (
      isSymbol(el, "(") ||
      isSymbol(el, ")") ||
      isSymbol(el, "[") ||
      isSymbol(el, "]")
    ) {
      const node = $createBracketNode(el);
      acc.push(node);
    }
    return acc;
  }, []);
};

const isBlockElement = (
  el: TokenStream[number],
  libraries: LibraryConfig[]
) => {
  return (
    (tokens.isNestedElement(el) && !isInlineElement(libraries, el)) ||
    tokens.isNestedDocument(el) ||
    tokens.isNestedFolder(el) ||
    tokens.isFileToken(el) ||
    tokens.isNestedCreator(el)
  );
};

export function splitStreamByBlocks(
  stream: TokenStream,
  libraries: LibraryConfig[]
) {
  const splitResult = tools.split(
    stream,
    (el) => tokens.isLineBreak(el) || isBlockElement(el, libraries)
  );

  let blocks = splitResult
    // we need to do this filter before the other one since the other one needs
    // to check both the current and next element
    .filter((el) => el.length > 0);
  /*
    .filter(
      (el, index, arr) =>
        // strings create paragraphs themselves
        !tokens.isLineBreak(el[0]) ||
        index === arr.length - 1 ||
        tokens.isLineBreak(arr[index + 1]?.[0])
    );
    */

  return blocks;
}

export function $createBlocksFromStream(
  initialState: TokenStream,
  libraries: LibraryConfig[]
) {
  const blocks: LexicalNode[] = [];

  const streamBlocks = splitStreamByBlocks(initialState, libraries);

  if (!streamBlocks.length) {
    const paragraphNode = $createParagraphNode();
    blocks.push(paragraphNode);
    return blocks;
  }

  streamBlocks.forEach((stream, index) => {
    if (stream.length === 1 && isBlockElement(stream[0], libraries)) {
      if (tokens.isNestedElement(stream[0])) {
        blocks.push($createLayoutElementNode(stream[0]));
      } else if (tokens.isNestedFolder(stream[0])) {
        blocks.push($createFolderNode(stream[0] as any));
      } else if (tokens.isNestedCreator(stream[0])) {
        blocks.push($createCreatorNode(stream[0] as any));
      } else if (tokens.isFileToken(stream[0])) {
        blocks.push($createFileNode(stream[0] as any));
      } else {
        blocks.push($createDocumentNode(stream[0] as any));
      }
    } else if (tokens.isLineBreak(stream[0])) {
      if (
        index === streamBlocks.length - 1 ||
        tokens.isLineBreak(streamBlocks[index + 1]?.[0])
      ) {
        const paragraphNode = $createParagraphNode();
        blocks.push(paragraphNode);
      }
    } else {
      const isHeading: false | string =
        typeof stream[0] === "string" &&
        (stream[0].match(/^(\#+)\s/)?.[1] ?? false);
      const paragraphNode = isHeading
        ? $createHeadingNode(`h${isHeading.length}` as "h1")
        : $createParagraphNode();
      stream = isHeading ? tools.slice(stream, 1 + isHeading.length) : stream;
      const nodes = $createInlinesFromStream(stream, libraries);
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
    const blocks = $createBlocksFromStream(initialState, libraries);
    root.append(...blocks);
  }
}

export async function replaceEditor(
  editor: LexicalEditor,
  stream: TokenStream,
  libraries: LibraryConfig[]
) {}

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
      !isInlineElement(libraries, lastNode.getToken())
    ) &&
    !$isDocumentNode(lastNode)
  ) {
    lastNode = lastNode!.getParent();
  }
  return lastNode;
}

export const $selectNode = (nodeKey: string) => {
  const nodeSelection = $createNodeSelection();
  nodeSelection.add(nodeKey);
  $setSelection(nodeSelection);
};
