import * as React from "react";
import {
  useEditorContext,
  useIsFocusedContext,
} from "../../editor/react/EditorProvider";
import useLayoutEffect from "../../editor/react/useLayoutEffect";
import { registerPlainText } from "../../editor/registerPlainText";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  LexicalEditor,
  LexicalNode,
  TextNode,
} from "lexical";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import {
  addDocumentImport,
  addFetcher,
  addImport,
  addLayoutElement,
  addNestedDocument,
} from "../../custom-events";
import {
  $getComputation,
  $getIndexesFromSelection,
  $getIndexFromPoint,
  $isSelection,
  getNodesFromComputation,
  isInlineElement,
} from "./transforms";
import { ComputationOp } from "shared/operations";
import { createId } from "@storyflow/backend/ids";
import {
  EditorComputation,
  DocumentId,
  FieldId,
  LayoutElement,
  TemplateFieldId,
} from "@storyflow/backend/types";
import { ClientConfig } from "@storyflow/frontend/types";
import { useClientConfig } from "../../client-config";
import { $isLayoutElementNode } from "../decorators/LayoutElementNode";
import { $isDocumentNode } from "../decorators/DocumentNode";
import { useFieldConfig } from "../../state/documentConfig";
import { useFieldId } from "../RenderField";
import { useArticleIdGenerator } from "../../id-generator";
import { operators } from "@storyflow/backend/types";
import { $isHeadingNode } from "../../editor/react/HeadingNode";

export const getDefaultComponent = (config: ClientConfig) => {
  return Object.entries(config.components).find(
    ([, value]) => value.isDefault
  )?.[0];
};

export const createComponent = (
  typeArg: string | null,
  config: ClientConfig
): LayoutElement => {
  const type = typeArg ?? getDefaultComponent(config) ?? "Text";
  const props = config.components[type].props ?? {};

  return {
    id: createId(1),
    type,
    props: Object.fromEntries(props.map(({ name }) => [name, []])),
  };
};

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

async function insertComputation(
  editor: LexicalEditor,
  insert: EditorComputation,
  config: ClientConfig,
  push?: (ops: ComputationOp["ops"]) => void
) {
  return await new Promise<boolean>((resolve) => {
    editor.update(() => {
      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        const anchor = selection.anchor;
        const focus = selection.focus;

        const isBefore = selection.isCollapsed() || anchor.isBefore(focus);
        const startPoint = isBefore ? anchor : focus;
        const endPoint = isBefore ? focus : anchor;

        const startNode = startPoint.getNode();

        if (selection.isCollapsed() && !$isTextNode(startNode)) {
          const placementNode = startNode.getChildAtIndex(startPoint.offset);
          const textNode = $createTextNode();
          const target = $isRootNode(startNode)
            ? $createParagraphNode().append(startNode)
            : textNode;
          if (placementNode === null) {
            startNode.append(target);
          } else {
            placementNode.insertBefore(target);
          }
          endPoint.set(textNode.__key, 0, "text");
          startPoint.set(textNode.__key, 0, "text");
        }

        const selectedNodes = selection.getNodes();
        let node = selectedNodes[0] as TextNode;

        if (
          selectedNodes.length !== 1 ||
          !$isTextNode(node) ||
          node.getMode() !== "normal"
        ) {
          resolve(false);
          return;
        }

        const index = $getIndexFromPoint(startPoint);

        if (index === null) {
          resolve(false);
          return;
        }

        const remove = endPoint.offset - startPoint.offset;

        if (insert.length === 1 && typeof insert[0] === "string") {
          node = node.spliceText(
            startPoint.offset,
            endPoint.offset - startPoint.offset,
            insert[0],
            true
          );

          if (node.getTextContent() === "") {
            node.remove();
          }
        } else {
          try {
            spliceTextWithNodes(
              node,
              startPoint.offset,
              endPoint.offset - startPoint.offset,
              getNodesFromComputation(insert, config)
            );
          } catch (err) {
            console.error(err);
            resolve(false);
          }
        }

        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
  /*
  if (action !== false) {
    push(action);
  }
  */
}

export function ContentPlugin({
  id,
  push,
}: {
  id?: string;
  push?: (ops: ComputationOp["ops"]) => void;
}) {
  const editor = useEditorContext();

  useEditorEvents({ id, push });

  useLayoutEffect(() => {
    return registerPlainText(editor, { allowLineBreaks: true });
  }, [editor]);

  return null;
}

function useEditorEvents({
  id,
  push,
}: {
  id?: string;
  push?: (ops: ComputationOp["ops"]) => void;
}) {
  const editor = useEditorContext();
  const isFocused = useIsFocusedContext();

  const config = useClientConfig();

  const fieldId = useFieldId();
  const [fieldConfig, setFieldConfig] = useFieldConfig(fieldId);

  const generateId = useArticleIdGenerator();

  React.useEffect(() => {
    if (isFocused) {
      const addBlockElement = (computation: EditorComputation) => {
        const node = getNodesFromComputation(computation, config)[0];
        const selection = $getSelection();
        if (!selection) return;
        const nodes = selection.getNodes();
        if (nodes.length === 0) return;
        let lastNode: LexicalNode | null = nodes[nodes.length - 1];
        if ($isRootNode(lastNode)) {
          lastNode.append(node);
          return;
        }
        while (
          lastNode &&
          !$isParagraphNode(lastNode!) &&
          !$isHeadingNode(lastNode!) &&
          !$isLayoutElementNode(lastNode!) &&
          !$isDocumentNode(lastNode!)
        ) {
          lastNode = lastNode!.getParent();
        }
        if (lastNode) {
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

          insertComputation(editor, insert, config, push);
        }),

        addDocumentImport.subscribe(async ({ documentId, templateId }) => {
          editor.update(() => {
            addBlockElement([
              {
                dref: documentId as DocumentId,
              },
            ]);
          });
          console.log("DOC", templateId, fieldConfig);
          if (templateId && !fieldConfig?.template) {
            setFieldConfig("template", templateId);
          }
        }),

        addLayoutElement.subscribe(async (type) => {
          const component = createComponent(type ?? null, config);
          const computation: EditorComputation = [component];
          if (isInlineElement(config, component)) {
            insertComputation(editor, computation, config, push);
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
  }, [editor, config, isFocused]);
}

export function useMathMode({
  push,
}: {
  push?: (ops: ComputationOp["ops"]) => void;
}) {
  const editor = useEditorContext();

  const state = React.useState(false);
  const [mathMode] = state;

  const config = useClientConfig();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      /*
      const computation = editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isSelection(selection)) {
          return [];
        }
        let [anchor] = $getIndexesFromSelection(selection);

        const compute = $getComputation($getRoot());

        return tools.slice(compute, 0, anchor);
      });

      const numberOpeners: number[] = [];
      const numberClosers: number[] = [];
      const textOpeners: number[] = [];
      const textClosers: number[] = [];

      computation.forEach((el, index) => {
        if (tools.isSymbol(el, "(")) {
          numberOpeners.push(index);
        } else if (tools.isSymbol(el, ")")) {
          numberClosers.push(index);
        } else if (tools.isSymbol(el, "(")) {
          textOpeners.push(index);
        } else if (tools.isSymbol(el, ")")) {
          textClosers.push(index);
        }
      });

      const hasNumberOpener = numberOpeners.length > numberClosers.length;
      const hasTextOpener = textOpeners.length > textClosers.length;
      const hasBoth = hasNumberOpener && hasTextOpener;

      let mode = null;
      let isPowerMode = mode === null ? !hasTextOpener : hasNumberOpener;

      if (hasBoth) {
        isPowerMode =
          Math.max(0, ...numberOpeners) > Math.max(0, ...textOpeners);
      }
      */

      const insert = (compute: EditorComputation) => {
        event.preventDefault();
        insertComputation(editor, compute, config, push);
      };

      if (mathMode) {
        if (operators.includes(event.key as any)) {
          insert([[event.key as "*"]]);
        } else if (event.key === ",") {
          insert([[","]]);
        } else if ("xyz".indexOf(event.key) >= 0) {
          insert([["xyz".indexOf(event.key)]]);
        }
      } else {
        if (!mathMode && event.key === "*") {
          insert([`\\*`]);
        }
      }

      if (event.key === "(") {
        insert([["("]]);
      } else if (event.key === "[") {
        insert([["("]]);
      } else if (event.key === ")") {
        insert([[")"]]);
      } else if (event.key === "]") {
        insert([[")"]]);
      }
    }
    return editor.registerRootListener((next, prev) => {
      if (prev) {
        prev.removeEventListener("keydown", onKeyDown);
      }
      if (next) {
        next.addEventListener("keydown", onKeyDown);
      }
    });
  }, [editor, config, mathMode]);

  return state;
}
