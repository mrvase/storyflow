import React from "react";
import {
  $createBlocksFromStream,
  $getComputation,
  $getIndexesFromSelection,
} from "./transforms";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_EDITOR,
  COPY_COMMAND,
  LexicalEditor,
  PASTE_COMMAND,
  ParagraphNode,
  TextNode,
} from "lexical";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { copyRecord } from "@storyflow/cms/copy-record";
import { useAppConfig } from "../../AppConfigContext";
import { useFieldId } from "../FieldIdContext";
import {
  getDocumentId,
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/cms/ids";
import type { DocumentId, FieldId } from "@storyflow/shared/types";
import type { SyntaxTree, SyntaxTreeRecord } from "@storyflow/cms/types";
import type { TokenStream } from "../../operations/types";
import { useDocumentIdGenerator } from "../../id-generator";
import {
  createTokenStream,
  parseTokenStream,
} from "../../operations/parse-token-stream";
import { store } from "../../state/state";
import { tokens } from "@storyflow/cms/tokens";
import { usePush } from "../../collab/CollabContext";
import { tools } from "../../operations/stream-methods";
import {
  $isTokenStreamNode,
  TokenStreamNode,
} from "./decorators/TokenStreamNode";
import { $replaceWithBlocks } from "./insertComputation";
import { createTransaction } from "@storyflow/collab/utils";
import { FieldTransactionEntry } from "../../operations/actions";
import { getSyntaxTreeEntries } from "@storyflow/cms/syntax-tree";
import {
  $createHeadingNode,
  HeadingNode,
} from "../../editor/react/HeadingNode";

const EVENT_LATENCY = 50;
let clipboardEventTimeout: null | number = null;

const emulateCopyEvent = (
  event: ClipboardEvent | KeyboardEvent,
  editor: LexicalEditor,
  callback: (event: ClipboardEvent) => boolean
): boolean => {
  if (clipboardEventTimeout !== null) {
    return false;
  }
  if (event instanceof ClipboardEvent) {
    return callback(event);
  } else {
    const rootElement = editor.getRootElement();
    const domSelection = document.getSelection();
    if (rootElement === null || domSelection === null) {
      return false;
    }
    const element = document.createElement("span");
    element.style.cssText = "position: fixed; top: -1000px;";
    element.append(document.createTextNode("#"));
    rootElement.append(element);
    const range = new Range();
    range.setStart(element, 0);
    range.setEnd(element, 1);
    domSelection.removeAllRanges();
    domSelection.addRange(range);

    const promise = new Promise((resolve, reject) => {
      const removeListener = editor.registerCommand(
        COPY_COMMAND,
        (secondEvent) => {
          if (secondEvent instanceof ClipboardEvent) {
            removeListener();
            if (clipboardEventTimeout !== null) {
              window.clearTimeout(clipboardEventTimeout);
              clipboardEventTimeout = null;
            }
            const result = callback(secondEvent);
            resolve(result);
            return result;
          }
          // Block the entire copy flow while we wait for the next ClipboardEvent
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      );
      // If the above hack execCommand hack works, this timeout code should never fire. Otherwise,
      // the listener will be quickly freed so that the user can reuse it again
      clipboardEventTimeout = window.setTimeout(() => {
        removeListener();
        clipboardEventTimeout = null;
        resolve(false);
      }, EVENT_LATENCY);
      document.execCommand("copy");
      element.remove();
    });

    return true;
  }
};

export function CopyPastePlugin() {
  const editor = useEditorContext();
  const { configs } = useAppConfig();
  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const push = usePush(documentId, getRawFieldId(id));

  React.useLayoutEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        COPY_COMMAND,
        (event) => {
          return emulateCopyEvent(event, editor, (event) => {
            const selection = $getSelection();
            console.log("selection", selection);
            if ($isRangeSelection(selection)) {
              console.log(
                selection.anchor.getNode(),
                selection.focus.getNode()
              );
            }

            const clipboardData = event.clipboardData;

            if (!clipboardData) {
              return false;
            }

            let computation: TokenStream;

            if ($isRangeSelection(selection)) {
              const [start, end] = $getIndexesFromSelection(selection);

              if (start === end) {
                return false;
              }

              const computationFull = $getComputation($getRoot());
              computation = tools.slice(computationFull, start, end);
            } else if ($isNodeSelection(selection)) {
              const nodes = selection
                .getNodes()
                .filter((el): el is TokenStreamNode<any, any> =>
                  $isTokenStreamNode(el)
                );
              computation = nodes.map((el) => el.getTokenStream()).flat(1);
            } else {
              return false;
            }

            const record: SyntaxTreeRecord = {};

            // find alle nested states
            const getNestedStates = (value: TokenStream) => {
              value.forEach((el) => {
                // only include nested states not imports
                // if there are imports that disappear from the store
                // they will be fetched again when using calculateFn
                if (tokens.isNestedEntity(el)) {
                  const states = store.useMany<SyntaxTree>(
                    new RegExp(`^${getRawDocumentId(el.id)}.*#tree`)
                  );
                  if (states) {
                    for (const entry of states) {
                      const value = entry[1].value;
                      if (!value) continue;
                      record[entry[0].replace("#tree", "") as FieldId] = value;
                      getNestedStates(createTokenStream(value));
                    }
                  }
                }
              });
            };

            getNestedStates(computation);

            // gem i { entry: computation, record: {} }
            const payload = {
              entry: parseTokenStream(computation),
              record,
              documentId,
            };

            console.log("PAYLOAD", payload);

            event.preventDefault();

            clipboardData.setData(
              "application/x-storyflow-syntax",
              JSON.stringify(payload)
            );

            let plainString = "";
            if (selection !== null) {
              plainString = selection.getTextContent();
            }

            clipboardData.setData("text/plain", plainString);

            return true;
          });
        },
        COMMAND_PRIORITY_EDITOR
      ),

      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const selection = $getSelection();

          if (!$isRangeSelection(selection)) {
            return false;
          }

          event.preventDefault();

          const clipboardData =
            event instanceof InputEvent || event instanceof KeyboardEvent
              ? null
              : event.clipboardData;

          if (clipboardData !== null && $isRangeSelection(selection)) {
            const computation = clipboardData.getData(
              "application/x-storyflow-syntax"
            );

            if (computation) {
              try {
                const payload = JSON.parse(computation) as {
                  entry: SyntaxTree;
                  record: SyntaxTreeRecord;
                  documentId: DocumentId;
                };

                console.log("PAYLOAD 1", payload);

                const {
                  ["000000000000000000000000" as FieldId]: entry,
                  ...record
                } = copyRecord(
                  {
                    ["000000000000000000000000" as FieldId]: payload.entry,
                    ...payload.record,
                  },
                  {
                    oldDocumentId: payload.documentId,
                    newDocumentId: documentId,
                    generateNestedDocumentId: () =>
                      generateDocumentId(documentId),
                  }
                );

                console.log("PAYLOAD 2", { entry, record });

                const transaction = createTransaction<
                  FieldTransactionEntry,
                  string
                >((t) => {
                  getSyntaxTreeEntries(record).forEach(([fieldId, value]) => {
                    t.target(fieldId).splice({
                      index: 0,
                      insert: createTokenStream(value),
                    });
                  });
                  return t;
                });

                push(transaction);

                const stream = createTokenStream(entry);

                const blocks = $createBlocksFromStream(stream, configs);
                $replaceWithBlocks(blocks);
                /*
                const lastNode = $getLastBlock(selection, libraries);
                if ($isRootNode(lastNode)) {
                  lastNode.append(...blocks);
                } else if (lastNode) {
                  const isEmpty = lastNode.getTextContent() === "";
                  if (isEmpty) {
                    blocks.forEach((node) => {
                      lastNode.insertBefore(node);
                    });
                  } else {
                    blocks
                      .slice()
                      .reverse()
                      .forEach((node) => {
                        lastNode.insertAfter(node);
                      });
                  }
                }
                */
                return true;
              } catch (err) {
                console.log("ERROR", err);
                return false;
              }
            }
          }

          editor.update(
            () => {
              if (clipboardData !== null && $isRangeSelection(selection)) {
                const text = clipboardData.getData("text/plain");
                let html = clipboardData.getData("text/html");

                html = html.replace(
                  /<(?!\/?(h[1-6]|strong|em|b|i|br|p|span)\b)[^>]*>/g,
                  ""
                );

                html = html.replace(/\r?\n/g, "<p></p>");

                html = html.replace(/\&nbsp\;/g, " ");

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const blocks: {
                  content: {
                    text: string;
                    modifier?: number;
                  }[];
                  tag: string;
                }[] = [
                  {
                    content: [],
                    tag: "p",
                  },
                ];

                const getContent = (node: HTMLElement) => {
                  let el = node.firstChild;

                  if (!el) return;

                  const hasCSS = (property: string, value: string) => {
                    return (
                      el instanceof HTMLElement &&
                      el.tagName === "SPAN" &&
                      (el as any).computedStyleMap().get(property) === value
                    );
                  };

                  while (el) {
                    const block = blocks[blocks.length - 1];
                    if (el instanceof Text) {
                      block.content.push({
                        text: el.textContent || "",
                      });
                    } else if (el instanceof HTMLElement) {
                      if (el.tagName === "BR") {
                        blocks.push({ content: [], tag: "p" });
                      } else if (el.tagName === "P") {
                        blocks.push({ content: [], tag: "p" });
                        getContent(el);
                        blocks.push({ content: [], tag: `p` });
                      } else if (
                        el.tagName === "STRONG" ||
                        el.tagName === "B" ||
                        hasCSS("font-style", "bold")
                      ) {
                        block.content.push({
                          text: el.textContent || "",
                          modifier: 1,
                        });
                      } else if (
                        el.tagName === "EM" ||
                        el.tagName === "I" ||
                        hasCSS("font-style", "italic")
                      ) {
                        block.content.push({
                          text: el.textContent || "",
                          modifier: 2,
                        });
                      } else if (el.tagName.match(/H\d/)) {
                        const level = parseInt(el.tagName[1]);
                        blocks.push({ content: [], tag: `h${level}` });
                        getContent(el);
                        blocks.push({ content: [], tag: `p` });
                      } else {
                        block.content.push({
                          text: el.textContent || "",
                        });
                      }
                    }
                    el = el.nextSibling;
                  }
                };

                try {
                  getContent(doc.body);
                  const hasContent = blocks.some((el) => el.content.length > 0);
                  let node = $isRangeSelection(selection)
                    ? selection.anchor.getNode()
                    : null;
                  node = node && $isTextNode(node) ? node.getParent() : node;
                  if (
                    hasContent &&
                    $isParagraphNode(node) &&
                    node.getTextContent() === ""
                  ) {
                    console.log("PASTED", { blocks, html });

                    const newNodes: (ParagraphNode | HeadingNode)[] = [];
                    blocks.forEach((block) => {
                      if (!block.content.length) return;
                      const newNode = block.tag
                        ? $createHeadingNode(block.tag as "h1")
                        : $createParagraphNode();

                      let node: TextNode | null = null;
                      block.content.forEach((el) => {
                        const newTextNode = $createTextNode(el.text);
                        if (el.modifier === 1) {
                          newTextNode.setFormat("bold");
                        } else if (el.modifier === 2) {
                          newTextNode.setFormat("italic");
                        }
                        if (!node) {
                          newNode.append(newTextNode);
                        } else {
                          node.insertAfter(newTextNode);
                        }
                        node = newTextNode;
                      });
                      newNodes.push(newNode);
                    });
                    let [newNode] = newNodes.splice(0, 1);
                    node.replace(newNode);
                    newNodes.forEach((el) => {
                      newNode.insertAfter(el);
                      newNode = el;
                    });
                    newNode.select();
                    return true;
                  }
                } catch (err) {}

                if (text != null) {
                  if ($isRangeSelection(selection)) {
                    const lines = text.split(/\r?\n/).filter((el) => el !== "");
                    const linesLength = lines.length;

                    for (let i = 0; i < linesLength; i++) {
                      selection.insertText(lines[i]);
                      if (i < linesLength - 1) {
                        selection.insertParagraph();
                      }
                    }
                  }
                }
              }
            },
            {
              tag: "paste",
            }
          );

          return true;
        },
        COMMAND_PRIORITY_EDITOR
      )
    );
  }, [editor, configs, documentId, id]);
  return null;
}
