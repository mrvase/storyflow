import React from "react";
import {
  $getBlocksFromComputation,
  $getComputation,
  $getLastBlock,
} from "./transforms";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_EDITOR,
  COPY_COMMAND,
  PASTE_COMMAND,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { copyRecord } from "../../documents/template-fields";
import { useClientConfig } from "../../client-config";
import { useFieldId } from "../FieldIdContext";
import {
  getDocumentId,
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import {
  DocumentId,
  FieldId,
  SyntaxTree,
  SyntaxTreeRecord,
  TokenStream,
} from "@storyflow/backend/types";
import { useDocumentIdGenerator } from "../../id-generator";
import { createTokenStream, parseTokenStream } from "shared/parse-token-stream";
import { store } from "../../state/state";
import { useClient } from "../../client";
import { tokens } from "@storyflow/backend/tokens";
import { useDocumentCollab } from "../../documents/collab/DocumentCollabContext";
import { ComputationOp, targetTools } from "shared/operations";

export function CopyPastePlugin() {
  const editor = useEditorContext();
  const { libraries } = useClientConfig();
  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();
  const client = useClient();

  const collab = useDocumentCollab();

  React.useLayoutEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        COPY_COMMAND,
        (event) => {
          const selection = $getSelection();

          if (
            !$isRangeSelection(selection) ||
            !(event instanceof ClipboardEvent)
          ) {
            return false;
          }

          const clipboardData = event.clipboardData;

          if (!clipboardData) {
            return false;
          }

          const computation = $getComputation($getRoot());

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

                // initialize states for record entries
                Object.entries(record).forEach(([fieldId, value]) => {
                  collab
                    .mutate<ComputationOp>(documentId, getRawFieldId(id))
                    .push({
                      target: targetTools.stringify({
                        field: "default", // should only be nested fields
                        operation: "computation",
                        location: fieldId,
                      }),
                      ops: [
                        {
                          index: 0,
                          insert: createTokenStream(value),
                        },
                      ],
                    });
                  /*
                  store.use(fieldId, () =>
                    calculateFn(fieldId, value, { client, record })
                  );
                  */
                });

                const stream = createTokenStream(entry);

                const blocks = $getBlocksFromComputation(stream, libraries);
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
  }, [editor, libraries, documentId, id, collab]);
  return null;
}