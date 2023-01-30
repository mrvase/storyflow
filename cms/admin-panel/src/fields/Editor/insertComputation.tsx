import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  LexicalEditor,
  TextNode,
} from "lexical";
import { $getIndexFromPoint, getNodesFromComputation } from "./transforms";
import { ComputationOp } from "shared/operations";
import { EditorComputation } from "@storyflow/backend/types";
import { LibraryConfig } from "@storyflow/frontend/types";
import { spliceTextWithNodes } from "./spliceTextWithNodes";

export async function insertComputation(
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
