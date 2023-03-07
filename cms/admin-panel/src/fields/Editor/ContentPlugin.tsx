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
  addFetcher,
  addImport,
  addLayoutElement,
  addNestedDocument,
} from "../../custom-events";
import { getNodesFromComputation, isInlineElement } from "./transforms";
import { ComputationOp } from "shared/operations";
import { createId } from "@storyflow/backend/ids";
import {
  EditorComputation,
  DocumentId,
  FieldId,
  TemplateFieldId,
} from "@storyflow/backend/types";
import { useClientConfig } from "../../client-config";
import { $isLayoutElementNode } from "../decorators/LayoutElementNode";
import { $isDocumentNode } from "../decorators/DocumentNode";
import { useFieldConfig } from "../../state/documentConfig";
import { useFieldId } from "../FieldIdContext";
import { useArticleIdGenerator } from "../../id-generator";
import { $isHeadingNode } from "../../editor/react/HeadingNode";
import { createComponent } from "./createComponent";
import { insertComputation } from "./insertComputation";
import { LibraryConfig } from "@storyflow/frontend/types";

export function ContentPlugin({ id }: { id?: string }) {
  const editor = useEditorContext();

  const { libraries } = useClientConfig();

  useEditorEvents({ id });

  useLayoutEffect(() => {
    return registerPlainText(editor, libraries, { allowLineBreaks: true });
  }, [editor, libraries]);

  return null;
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

function useEditorEvents({ id }: { id?: string }) {
  const editor = useEditorContext();
  const isFocused = useIsFocusedContext();

  const { libraries } = useClientConfig();

  const fieldId = useFieldId();
  const [fieldConfig, setFieldConfig] = useFieldConfig(fieldId);

  const generateId = useArticleIdGenerator();

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
          if (id && imports.includes(id)) {
            console.error("Tried to add itself");
            return;
          }
          let insert = [
            {
              id: createId(1),
              fref: externalId as FieldId,
              ...(templateId && { pick: templateId as TemplateFieldId }),
              args: {},
            },
          ];

          insertComputation(editor, insert, libraries);
        }),

        addContext.subscribe(async (ctx) => {
          let insert = [
            {
              ctx,
            },
          ];

          insertComputation(editor, insert, libraries);
        }),

        addDocumentImport.subscribe(async ({ documentId, templateId }) => {
          editor.update(() => {
            addBlockElement([
              {
                dref: documentId as DocumentId,
              },
            ]);
          });
          if (templateId && !fieldConfig?.template) {
            setFieldConfig("template", templateId);
          }
        }),

        addLayoutElement.subscribe(async ({ library, name }) => {
          const component = createComponent(name, { library, libraries });
          const computation: EditorComputation = [component];
          if (isInlineElement(libraries, component)) {
            insertComputation(editor, computation, libraries);
          } else {
            editor.update(() => {
              addBlockElement(computation);
            });
          }
        }),

        addNestedDocument.subscribe(async () => {
          const id = await generateId();
          editor.update(() => {
            addBlockElement([{ id, values: {} }]);
          });
        }),
        addFetcher.subscribe(async () => {
          const id = await generateId();
          editor.update(() => {
            addBlockElement([{ id, filters: [] }]);
          });
        })
      );
    }
  }, [editor, libraries, isFocused]);
}
