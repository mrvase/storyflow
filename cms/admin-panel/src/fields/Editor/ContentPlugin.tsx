import * as React from "react";
import {
  useEditorContext,
  useIsFocusedContext,
} from "../../editor/react/EditorProvider";
import useLayoutEffect from "../../editor/react/useLayoutEffect";
import { registerPlainText } from "../../editor/registerPlainText";
import {
  $getSelection,
  $isParagraphNode,
  $isRootNode,
  GridSelection,
  LexicalNode,
  NodeSelection,
  RangeSelection,
} from "lexical";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import {
  addContext,
  addDocumentImport,
  addImport,
  addLayoutElement,
  addNestedDocument,
  addNestedFolder,
} from "../../custom-events";
import {
  $getLastBlock,
  getNodesFromComputation,
  isInlineElement,
} from "./transforms";
import { DocumentId, EditorComputation } from "@storyflow/backend/types";
import { useClientConfig } from "../../client-config";
import { $isLayoutElementNode } from "../decorators/LayoutElementNode";
import { $isDocumentNode } from "../decorators/DocumentNode";
import { useFieldConfig } from "../../documents/collab/hooks";
import { useFieldId } from "../FieldIdContext";
import { $isHeadingNode } from "../../editor/react/HeadingNode";
import { createComponent } from "./createComponent";
import { insertComputation } from "./insertComputation";
import { LibraryConfig } from "@storyflow/frontend/types";
import { useDocumentIdGenerator } from "../../id-generator";
import { getDocumentId } from "@storyflow/backend/ids";

export function ContentPlugin() {
  const editor = useEditorContext();

  const { libraries } = useClientConfig();

  useEditorEvents();

  useLayoutEffect(() => {
    return registerPlainText(editor, libraries, { allowLineBreaks: true });
  }, [editor, libraries]);

  return null;
}

function useEditorEvents() {
  const editor = useEditorContext();
  const isFocused = useIsFocusedContext();

  const { libraries } = useClientConfig();

  const fieldId = useFieldId();

  const documentId = getDocumentId(fieldId) as DocumentId;

  const [fieldConfig, setFieldConfig] = useFieldConfig(fieldId);

  const generateDocumentId = useDocumentIdGenerator();

  React.useEffect(() => {
    if (isFocused) {
      const addBlockElement = (computation: EditorComputation) => {
        const node = getNodesFromComputation(computation, libraries)[0];
        const selection = $getSelection();
        if (!selection) return;
        const lastNode = $getLastBlock(selection, libraries);
        if ($isRootNode(lastNode)) {
          lastNode.append(node);
        } else if (lastNode) {
          const isEmpty = lastNode.getTextContent() === "";
          if (isEmpty) {
            lastNode.insertBefore(node);
          } else {
            lastNode.insertAfter(node);
          }
          return;
        }
        // $insertNodeToNearestRoot(node);
      };

      return mergeRegister(
        addImport.subscribe(async ({ id: externalId, templateId, imports }) => {
          if (fieldId && imports.includes(fieldId)) {
            console.error("Tried to add itself");
            return;
          }
          let insert: EditorComputation = [
            {
              id: generateDocumentId(documentId),
              field: externalId,
              ...(templateId && { pick: templateId }),
              imports: {},
            },
          ];

          insertComputation(editor, insert, libraries);
        }),

        addContext.subscribe(async (ctx) => {
          let insert: EditorComputation = [
            {
              ctx,
            },
          ];

          insertComputation(editor, insert, libraries);
        }),

        addNestedFolder.subscribe(async ({ folderId, templateId }) => {
          editor.update(() => {
            addBlockElement([
              {
                id: generateDocumentId(documentId),
                folder: folderId,
              },
            ]);
          });
          if (templateId && !fieldConfig?.template) {
            setFieldConfig("template", templateId);
          }
        }),

        addDocumentImport.subscribe(async ({ documentId, templateId }) => {
          editor.update(() => {
            addBlockElement([
              {
                id: documentId,
              },
            ]);
          });
          if (templateId && !fieldConfig?.template) {
            setFieldConfig("template", templateId);
          }
        }),

        addLayoutElement.subscribe(async ({ library, name }) => {
          const component = createComponent(
            generateDocumentId(documentId),
            name,
            { library, libraries }
          );

          const computation: EditorComputation = [component];

          if (isInlineElement(libraries, component)) {
            insertComputation(editor, computation, libraries);
          } else {
            editor.update(() => {
              addBlockElement(computation);
            });
          }
        }),

        addNestedDocument.subscribe(() => {
          editor.update(() => {
            addBlockElement([{ id: generateDocumentId(documentId) }]);
          });
        })
      );
    }
  }, [editor, libraries, isFocused, fieldId, generateDocumentId]);
}
