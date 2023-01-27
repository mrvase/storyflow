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
import {
  ClientConfig,
  ComponentConfig,
  LibraryConfig,
} from "@storyflow/frontend/types";
import {
  getComponentType,
  getConfigFromType,
  useClientConfig,
} from "../../client-config";
import { $isLayoutElementNode } from "../decorators/LayoutElementNode";
import { $isDocumentNode } from "../decorators/DocumentNode";
import { useFieldConfig } from "../../state/documentConfig";
import { useFieldId } from "../RenderField";
import { useArticleIdGenerator } from "../../id-generator";
import { operators } from "@storyflow/backend/types";
import { $isHeadingNode } from "../../editor/react/HeadingNode";

export const createComponent = (
  name: string,
  option:
    | { library: string; config: ComponentConfig }
    | { library: string; libraries: LibraryConfig[] }
): LayoutElement => {
  let config: ComponentConfig | undefined;

  const type = getComponentType(option.library, name);

  if ("libraries" in option) {
    config = getConfigFromType(type, option.libraries);
  } else {
    config = option.config;
  }

  if (!config) {
    return {
      id: createId(1),
      type,
      props: {},
    };
  }

  return {
    id: createId(1),
    type,
    props: Object.fromEntries(config.props.map(({ name }) => [name, []])),
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
  libraries: LibraryConfig[],
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

        let startNode = startPoint.getNode();

        if ($isRootNode(startNode) && startNode.getTextContent() === "") {
          const root = startNode;
          startNode = $createParagraphNode();
          root.append(startNode);
        }

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
              getNodesFromComputation(insert, libraries)
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

          insertComputation(editor, insert, libraries, push);
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
            insertComputation(editor, computation, libraries, push);
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

export function useMathMode({
  push,
}: {
  push?: (ops: ComputationOp["ops"]) => void;
}) {
  const editor = useEditorContext();

  const state = React.useState(false);
  const [mathMode] = state;

  const { libraries } = useClientConfig();

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
        insertComputation(editor, compute, libraries, push);
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
  }, [editor, libraries, mathMode]);

  return state;
}
