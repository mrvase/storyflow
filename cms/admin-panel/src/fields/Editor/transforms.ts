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
import { tools } from "../../operations/stream-methods";
import {
  matchNonEscapedCharacter,
  splitByNonEscapedCharacter,
} from "../../operations/escaped-characters";
import type {
  FunctionName,
  LibraryConfigRecord,
  NestedElement,
} from "@storyflow/shared/types";
import type { TokenStream } from "../../operations/types";
import type { LibraryConfig } from "@storyflow/shared/types";
import { getConfigFromType } from "../../AppConfigContext";
import { tokens } from "@storyflow/cms/tokens";
import { isSymbol } from "../../operations/is-symbol";

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
import { $createDateNode } from "./decorators/DateNode";
import { $createBooleanNode } from "./decorators/BooleanNode";
import { $createBlockNode, $isBlockNode } from "./decorators/BlockNode";
import { isFunctionSymbol } from "@storyflow/cms/symbols";
import { FunctionSymbol } from "@storyflow/cms/types";
import { $isAICompletionNode } from "./decorators/AICompletionNode";

export const isInlineElement = (
  configs: LibraryConfigRecord,
  element: NestedElement
): element is typeof element & { inline: true } => {
  const config = getConfigFromType(element.element, configs);
  const result = Boolean(config?.inline);
  return result;
};

export const $isTextBlockNode = (
  node: LexicalNode | null | undefined
): node is ParagraphNode | HeadingNode =>
  $isHeadingNode(node) || $isParagraphNode(node);

type StreamContent = {
  type: "stream";
  value: TokenStream;
  returnValue: TokenStream;
};

type TextContent = {
  type: "text";
  value: string[];
  returnValue: string;
};

type Content = TextContent | StreamContent;

type Methods<TValue extends TokenStream | string[]> = {
  getContent: (node: LexicalNode) => TValue;
  concat: (arg: TValue, ...args: TValue[]) => TValue;
  linebreak: TValue[number];
};

const streamMethods: Methods<TokenStream> = {
  getContent: (node: LexicalNode) => node.getTokenStream(),
  concat: (arg: TokenStream, ...args: TokenStream[]) =>
    tools.concat(arg, ...args),
  linebreak: { n: true },
};

const textMethods: Methods<string[]> = {
  getContent: (node: LexicalNode) => [node.getTextContent()],
  concat: (arg: string[], ...args: string[][]) => arg.concat(...args),
  linebreak: "\n",
};

const $getNodeContent = <TContent extends Content>(
  node: LexicalNode,
  type: TContent["type"],
  endAt?: string
): TContent["returnValue"] => {
  type TValue = TContent["value"];

  const methods = (
    type === "stream" ? streamMethods : textMethods
  ) as Methods<TValue>;

  const recursivelyGetContent = (
    node: LexicalNode,
    prevContent: TValue = []
  ): { content: TValue; ended: boolean } => {
    if (node.getKey() === endAt) {
      return { content: [], ended: true };
    }
    let content: TValue = [];
    if ($isElementNode(node)) {
      const children = node.getChildren?.();
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.getKey() === endAt) {
            return { content, ended: true };
          }
          if (
            i > 0 &&
            $isTextBlockNode(child) &&
            $isTextBlockNode(children[i - 1])
          ) {
            content = methods.concat(content, [methods.linebreak]);
          }
          const { content: newContent, ended } = recursivelyGetContent(
            child,
            content
          );
          if ($isHeadingNode(child) && newContent.length > 0) {
            const level = parseInt(child.__tag.slice(1), 10);
            content = methods.concat(content, [`${"#".repeat(level)} `]);
          }
          content = methods.concat(content, newContent);
          if (ended) {
            return {
              ended: true,
              content,
            };
          }
        }
      }
      if ($isBlockNode(node) && type === "stream") {
        const func = node.__func;
        content = methods.concat([{ "(": true }], content, [func]);
      }
    } else if ($isPromptNode(node) || $isAICompletionNode(node)) {
      content = methods.getContent(node);
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
            last = last.slice(0, -1);
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
      content = methods.getContent(node);
    }
    return { content, ended: false };
  };

  let { content } = recursivelyGetContent(node);

  return type === "text" ? content.join("") : content;
};

const $getTextContent = (node: LexicalNode, endAt?: string) => {
  return $getNodeContent<TextContent>(node, "text", endAt);
};

export const $getComputation = (node: LexicalNode, endAt?: string) => {
  return $getNodeContent<StreamContent>(node, "stream", endAt);
};

export const $getContentLength = (node: LexicalNode, endAt?: string) => {
  return $getTextContent(node, endAt).length;
};

export const $getStartIndexFromNodeKey = (key: string): number => {
  const textBefore = $getContentLength($getRoot(), key);
  return textBefore;
};

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

type CustomPointType = {
  type: "text" | "element";
  offset: number;
  node: LexicalNode;
};

export const $getStartAndEndExtended = (
  selection: RangeSelection | NodeSelection
): [CustomPointType, CustomPointType] => {
  if ($isRangeSelection(selection)) {
    const [start, end] = $getStartAndEnd(selection);
    const point: CustomPointType = {
      type: start.type,
      offset: start.offset,
      node: start.getNode(),
    };

    if (selection.isCollapsed()) {
      return [point, point];
    }
    return [
      point,
      {
        type: end.type,
        offset: end.offset,
        node: end.getNode(),
      },
    ];
  } else {
    const node = selection.getNodes()[0];
    const offset = node.getIndexWithinParent();
    const parent: LexicalNode = node.getParent()!;
    const point: CustomPointType = {
      type: "element",
      offset,
      node: parent,
    };
    return [point, point];
  }
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
  configs: LibraryConfigRecord
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
      const node = $createBooleanNode(el);
      acc.push(node);
    } else if (tokens.isDateToken(el)) {
      const node = $createDateNode(el);
      acc.push(node);
    } else if (tokens.isNestedField(el)) {
      const node = $createImportNode(el);
      acc.push(node);
    } else if (tokens.isParameter(el)) {
      const node = $createParameterNode(el);
      acc.push(node);
    } else if (tokens.isNestedElement(el)) {
      if (isInlineElement(configs, el)) {
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
  configs: LibraryConfigRecord
) => {
  return (
    typeof el === "boolean" ||
    (tokens.isNestedElement(el) && !isInlineElement(configs, el)) ||
    tokens.isNestedDocument(el) ||
    tokens.isNestedFolder(el) ||
    tokens.isFileToken(el) ||
    tokens.isColorToken(el) ||
    tokens.isDateToken(el) ||
    tokens.isCustomToken(el) ||
    tokens.isNestedCreator(el)
  );
};

const isComma = (el: unknown): el is { ",": true } =>
  typeof el === "object" && el !== null && "," in el;

export function splitStreamByBlocks(
  stream: TokenStream,
  configs: LibraryConfigRecord
) {
  const splitResult = tools.split(
    stream,
    (el) => tokens.isLineBreak(el) || isBlockElement(el, configs)
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

function splitStreamByFunctions(stream: TokenStream) {
  const result: (TokenStream | { func: FunctionSymbol; group: TokenStream })[] =
    [];

  let group: TokenStream = [];
  let level = 0;

  stream.forEach((el) => {
    if (isSymbol(el, "(")) {
      if (level === 0) {
        result.push(group);
        group = [];
      } else {
        group.push(el);
      }
      level++;
    } else if (isFunctionSymbol(el)) {
      if (level === 1) {
        result.push({ func: el, group });
        group = [];
      } else {
        group.push(el);
      }
      level--;
    } else {
      group.push(el);
    }
  });

  result.push(group);

  const filtered = result.filter((el) => !Array.isArray(el) || el.length > 0);

  if (filtered.length === 0) {
    return [[]];
  }

  return filtered;
}

export function $createBlocksFromStream(
  initialState: TokenStream,
  configs: LibraryConfigRecord
) {
  const blocks: LexicalNode[] = [];

  const streamFunctions = splitStreamByFunctions(initialState);

  streamFunctions.map((el) => {
    if (typeof el === "object" && el !== null && "group" in el) {
      const childrenBlocks = $createBlocksFromStream(el.group, configs);
      const node = $createBlockNode(el.func);
      node.append(...childrenBlocks);
      blocks.push(node);
    } else {
      const streamBlocks = splitStreamByBlocks(el, configs);

      if (!streamBlocks.length) {
        const paragraphNode = $createParagraphNode();
        blocks.push(paragraphNode);
        return blocks;
      }

      streamBlocks.forEach((stream, index) => {
        if (stream.length === 1 && isBlockElement(stream[0], configs)) {
          const el = stream[0];
          if (typeof el === "boolean") {
            blocks.push($createBooleanNode(el));
          } else if (tokens.isNestedElement(el)) {
            blocks.push($createLayoutElementNode(el));
          } else if (tokens.isNestedFolder(el)) {
            blocks.push($createFolderNode(el));
          } else if (tokens.isNestedCreator(el)) {
            blocks.push($createCreatorNode(el));
          } else if (tokens.isColorToken(el)) {
            blocks.push($createColorNode(el));
          } else if (tokens.isCustomToken(el)) {
            blocks.push($createCustomTokenNode(el));
          } else if (tokens.isDateToken(el)) {
            blocks.push($createDateNode(el));
          } else if (tokens.isFileToken(el)) {
            blocks.push($createFileNode(el));
          } else {
            blocks.push($createDocumentNode(el as any));
          }
        } else if (tokens.isLineBreak(stream[0])) {
          if (index === 0) {
            const paragraphNode = $createParagraphNode();
            blocks.push(paragraphNode);
          }
          if (tokens.isLineBreak(streamBlocks[index + 1]?.[0])) {
            const paragraphNode = $createParagraphNode();
            blocks.push(paragraphNode);
          }
          if (index === streamBlocks.length - 1) {
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
          stream = isHeading
            ? tools.slice(stream, 1 + isHeading.length)
            : stream;
          const nodes = $createInlinesFromStream(stream, configs);
          paragraphNode.append(...nodes);
          blocks.push(paragraphNode);
        }
      });
    }
  });

  return blocks;
}

export function $initializeEditor(
  initialState: TokenStream,
  configs: LibraryConfigRecord
): void {
  const root = $getRoot();

  if (root.isEmpty()) {
    const blocks = $createBlocksFromStream(initialState, configs);
    root.append(...blocks);
  }
}

export function $clearEditor() {
  const root = $getRoot();
  root.clear();
}

export function $getLastBlock(
  selection: RangeSelection | NodeSelection | GridSelection,
  configs: LibraryConfigRecord
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
      !isInlineElement(configs, lastNode.getToken())
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
