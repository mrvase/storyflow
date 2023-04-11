import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  $setSelection,
  DecoratorNode,
  LexicalEditor,
  LexicalNode,
  ParagraphNode,
  TextNode,
} from "lexical";
import {
  $getBlocksFromComputation,
  $getStartAndEnd,
  $isTextBlockNode,
} from "./transforms";
import { TokenStream } from "@storyflow/backend/types";
import { LibraryConfig } from "@storyflow/frontend/types";
import { $isPromptNode } from "./decorators/PromptNode";
import { $isHeadingNode, HeadingNode } from "../../editor/react/HeadingNode";

const $isMergeableTextNode = (node: LexicalNode | null | undefined) =>
  $isTextNode(node) && !$isPromptNode(node);

const remove = (node: LexicalNode) => node.remove(); // removeNode(node, false, false);

const insertAfter = (node: LexicalNode, inserts: LexicalNode[]) =>
  inserts.reduce((a, c) => a.insertAfter(c), node);

const insertBefore = (node: LexicalNode, inserts: LexicalNode[]) =>
  inserts
    .slice()
    .reverse()
    .reduce((a, c) => a.insertBefore(c), node);

function $createSimilarNode(node: ParagraphNode): ParagraphNode;
function $createSimilarNode(node: HeadingNode): HeadingNode;
function $createSimilarNode(node: ParagraphNode | HeadingNode) {
  if ($isHeadingNode(node)) {
    return new HeadingNode(node.getTag());
  } else if ($isParagraphNode(node)) {
    return $createParagraphNode();
  }
}

export function $replaceWithBlocks(
  editor: LexicalEditor,
  newBlocks: LexicalNode[]
) {
  try {
    const merge = (
      left: ParagraphNode | HeadingNode,
      right: ParagraphNode | HeadingNode,
      options: { keep?: "left" | "right"; cursor?: "middle" | "right" } = {}
    ) => {
      const leftChild = left.getLastChild()!;
      const rightChild = right.getFirstChild()!;

      const cursorRight = options.cursor === "right";
      const cursorChild = cursorRight ? rightChild : leftChild;

      const type = $isTextNode(cursorChild) ? "text" : "element";
      let offset = type === "text" ? cursorChild.getTextContent().length : -1;
      let node = cursorChild;

      console.log("$ MERGE", {
        left,
        right,
        options,
        leftChild,
        rightChild,
        select: { type, offset, node },
      });

      const reverse = options.keep === "right";
      const [childToKeep, childToRemove] = [leftChild, rightChild][
        reverse ? "reverse" : "slice"
      ]();

      if (
        $isMergeableTextNode(childToKeep) &&
        $isMergeableTextNode(childToRemove) &&
        childToKeep.getFormat() === childToRemove.getFormat()
      ) {
        offset += cursorRight ? leftChild.getTextContent().length : 0;
        // merge adjacent text nodes
        childToKeep.getWritable().__text =
          leftChild.getTextContent() + rightChild.getTextContent();
        remove(childToRemove);
        node = childToKeep;
      }

      // merge children
      if (reverse) {
        console.log("$ SPLICING RIGHT", {
          right: right.getChildren(),
          left: left.getChildren(),
        });
        right.splice(0, 0, left.getChildren());
        if (node === left) {
          node = right;
        }
      } else {
        console.log("$ SPLICING LEFT", {
          left: left.getChildren(),
          size: left.getChildrenSize(),
          right: right.getChildren(),
        });
        left.splice(left.getChildrenSize(), 0, right.getChildren());
      }

      return {
        type,
        offset,
        node,
      };
    };

    const selection = $getSelection()?.clone();

    // to make methods not consider selection for performance
    $setSelection(null);

    if ($isRangeSelection(selection)) {
      const [startPoint, endPoint] = $getStartAndEnd(selection);
      let startNode = startPoint.getNode();
      let endNode = endPoint.getNode();

      console.log("$ selection", {
        anchor: { ...selection.anchor },
        focus: { ...selection.focus },
        startNode,
        endNode,
      });

      // handle empty root node
      if ($isRootNode(startNode) && startNode.getTextContent() === "") {
        startNode.append(...newBlocks);
        return;
      }

      let leftBlock: LexicalNode | null = null;
      let rightBlock: LexicalNode | null = null;

      let blockLeftMerge = false;
      let blockRightMerge = false;

      if (selection.isCollapsed()) {
        console.log("$ COLLAPSED");
        if (startPoint.type === "text") {
          if (startPoint.offset === 0) {
            const textNode = startNode as TextNode;
            const prevChildren = textNode.getPreviousSiblings();

            rightBlock = textNode.getParentOrThrow();

            if (prevChildren.length) {
              // There are other inline nodes. Split into two blocks that contain inline nodes that come before and after the cursor.
              leftBlock = $createSimilarNode(rightBlock as ParagraphNode);
              rightBlock.splice(0, prevChildren.length, []);
              leftBlock.append(...prevChildren);
              rightBlock.insertBefore(leftBlock);
            } else {
              // We are at the beginning of the block.
              leftBlock = rightBlock.getPreviousSibling();
              blockLeftMerge = true;
            }
          } else if (startPoint.offset === startNode.getTextContent().length) {
            const textNode = startNode as TextNode;
            const nextChildren = textNode.getNextSiblings();

            leftBlock = textNode.getParentOrThrow();

            if (nextChildren.length) {
              // There are other inline nodes...
              rightBlock = $createSimilarNode(leftBlock as ParagraphNode);
              leftBlock.splice(
                leftBlock.getChildrenSize() - nextChildren.length,
                nextChildren.length,
                []
              );
              rightBlock.append(...nextChildren);
              leftBlock.insertAfter(rightBlock);
            } else {
              // We are at the end of the block.
              rightBlock = leftBlock.getNextSibling();
              blockRightMerge = true;
            }
          } else {
            // We are in the middle of a text node. Split it into two separate blocks with each their part of the text node.

            const [, textRight] = (startNode as TextNode).splitText(
              startPoint.offset
            );

            rightBlock = textRight.getParentOrThrow();
            leftBlock = $createSimilarNode(rightBlock as ParagraphNode);

            let prevChildren = textRight.getPreviousSiblings();
            rightBlock.splice(0, prevChildren.length, []);
            leftBlock.append(...prevChildren);
            rightBlock.insertBefore(leftBlock);
          }
        } else {
          if ($isRootNode(startNode)) {
            // the index indicates the position of a block element
            leftBlock = startNode.getChildAtIndex(startPoint.offset - 1);
          } else {
            // the index indicates the position of an inline element
            leftBlock = startNode; // the block element

            let inlineNode = startNode.getChildAtIndex(startPoint.offset - 1);

            if (inlineNode) {
              const nextChildren = inlineNode.getNextSiblings();

              if (nextChildren.length) {
                rightBlock = $createSimilarNode(leftBlock as ParagraphNode);
                (leftBlock as ParagraphNode).splice(
                  leftBlock.getChildrenSize() - nextChildren.length,
                  nextChildren.length,
                  []
                );
                rightBlock.append(...nextChildren);
                leftBlock.insertAfter(rightBlock);
              } else {
                rightBlock = leftBlock.getNextSibling();
              }
            }
          }
        }
      } else {
        console.log("$ NOT COLLAPSED");

        const startIndexNode =
          startPoint.type === "element"
            ? startNode.getChildAtIndex(startPoint.offset - 1)
            : null;

        const endIndexNode =
          endPoint.type === "element"
            ? endNode.getChildAtIndex(endPoint.offset - 1)
            : null;

        // handle endpoint first and get rightBlock

        if (endPoint.offset === endNode.getTextContent().length) {
          // we start with this to block right merge even if we are also at the start of the block

          /* tekst|(possible decorator) */
          const textNode = endNode as TextNode;
          const nextChildren = textNode.getNextSiblings();

          let restBlock = textNode.getParentOrThrow() as ParagraphNode;

          if (nextChildren.length) {
            rightBlock = $createSimilarNode(restBlock);
            restBlock.splice(
              restBlock.getChildrenSize() - nextChildren.length,
              nextChildren.length,
              []
            );
            rightBlock.append(...nextChildren);
            restBlock.insertAfter(rightBlock);
            console.log(
              "$ not collapsed -> endpoint -> text -> offset last -> does have next",
              [...nextChildren]
            );
          } else {
            rightBlock = restBlock.getNextSibling();
            console.log(
              "$ not collapsed -> endpoint -> text -> offset last -> does NOT have next"
            );
            blockRightMerge = true;
          }
        } else if (endPoint.type === "text") {
          if (endPoint.offset === 0) {
            /* (possible decorator)|tekst */
            const textNode = endNode as TextNode;
            const prevChildren = textNode.getPreviousSiblings();

            rightBlock = textNode.getParentOrThrow();

            if (prevChildren.length) {
              let restBlock = $createSimilarNode(rightBlock as ParagraphNode);
              rightBlock.splice(0, prevChildren.length, []);
              restBlock.append(...prevChildren);
              rightBlock.insertBefore(restBlock);
              console.log(
                "$ not collapsed -> endpoint -> text -> offset 0 -> does have prev"
              );
            } else {
              let restBlock = rightBlock.getPreviousSibling();
              console.log(
                "$ not collapsed -> endpoint -> text -> offset 0 -> does NOT have prev"
              );
            }
          } else {
            const [, textRight] = (endNode as TextNode).splitText(
              endPoint.offset
            );

            rightBlock = textRight.getParentOrThrow();
            let restBlock = $createSimilarNode(rightBlock as ParagraphNode);

            let prevChildren = textRight.getPreviousSiblings();
            rightBlock.splice(0, prevChildren.length, []);
            restBlock.append(...prevChildren);
            rightBlock.insertBefore(restBlock);

            console.log("$ not collapsed -> endpoint -> text -> offset middle");
          }
        } else {
          if ($isRootNode(endNode)) {
            rightBlock = endIndexNode;
            console.log("$ not collapsed -> endpoint -> element -> root");
          } else {
            let inlineNode = endIndexNode;

            rightBlock = inlineNode.getParentOrThrow() as LexicalNode; // this might have changed to a restBlock

            console.log("$ INLINE", inlineNode);

            if (inlineNode) {
              // DELETE INLINE NODE AS WELL (part of selection)
              const prevChildren = [
                ...inlineNode.getPreviousSiblings(),
                inlineNode,
              ];

              if (prevChildren.length) {
                let restBlock = $createSimilarNode(rightBlock as ParagraphNode);
                (rightBlock as ParagraphNode).splice(
                  0,
                  prevChildren.length,
                  []
                );
                restBlock.append(...prevChildren);
                rightBlock.insertBefore(restBlock);
                console.log(
                  "$ not collapsed -> endpoint -> element -> inline node -> does have prev",
                  prevChildren
                );
              } else {
                let restBlock = rightBlock.getPrevSibling();
                console.log(
                  "$ not collapsed -> endpoint -> element -> inline node -> does NOT have prev"
                );
              }
            } else {
              console.log(
                "$ not collapsed -> endpoint -> element -> NO inline node"
              );
            }
          }
        }

        // then handle startPoint and get leftBlock

        if (startPoint.type === "text") {
          if (startPoint.offset === 0) {
            /* (possible decorator)|tekst */
            const textNode = startNode as TextNode;
            const prevChildren = textNode.getPreviousSiblings();

            const restBlock = textNode.getParentOrThrow();

            if (prevChildren.length) {
              leftBlock = $createSimilarNode(restBlock as ParagraphNode);
              restBlock.splice(0, prevChildren.length, []);
              leftBlock.append(...prevChildren);
              restBlock.insertBefore(leftBlock);
              console.log(
                "$ not collapsed -> startpoint -> text -> offset 0 -> does have prev"
              );
            } else {
              leftBlock = restBlock.getPreviousSibling();
              console.log(
                "$ not collapsed -> startpoint -> text -> offset 0 -> does NOT have prev"
              );
              blockLeftMerge = true;
            }
          } else if (startPoint.offset === startNode.getTextContent().length) {
            /* tekst|(possible decorator) */
            const textNode = startNode as TextNode;
            const nextChildren = textNode.getNextSiblings();

            leftBlock = textNode.getParentOrThrow();

            if (nextChildren.length) {
              const restBlock = $createSimilarNode(leftBlock as ParagraphNode);
              leftBlock.splice(
                leftBlock.getChildrenSize() - nextChildren.length,
                nextChildren.length,
                []
              );
              restBlock.append(...nextChildren);
              leftBlock.insertAfter(restBlock);
              console.log(
                "$ not collapsed -> startpoint -> text -> offset last -> does have next"
              );
            } else {
              let restBlock = leftBlock.getNextSibling();

              console.log(
                "$ not collapsed -> startpoint -> text -> offset last -> does NOT have next"
              );
            }
          } else {
            const [, textRight] = (startNode as TextNode).splitText(
              startPoint.offset
            );

            let restBlock = textRight.getParentOrThrow() as ParagraphNode;
            leftBlock = $createSimilarNode(restBlock);

            let prevChildren = textRight.getPreviousSiblings();
            restBlock.splice(0, prevChildren.length, []);
            leftBlock.append(...prevChildren);
            restBlock.insertBefore(leftBlock);

            console.log(
              "$ not collapsed -> startpoint -> text -> offset middle"
            );
          }
        } else {
          if ($isRootNode(startNode)) {
            // not sure this always exists??
            leftBlock = startIndexNode;
            console.log("$ not collapsed -> startpoint -> element -> root");
          } else {
            let inlineNode = startIndexNode;

            if (inlineNode) {
              leftBlock = inlineNode.getParentOrThrow() as LexicalNode; // this might have changed to a restBlock

              const nextChildren = inlineNode.getNextSiblings();

              if (nextChildren.length) {
                let restBlock = $createSimilarNode(leftBlock as ParagraphNode);
                (leftBlock as ParagraphNode).splice(
                  leftBlock.getChildrenSize() - nextChildren.length,
                  nextChildren.length,
                  []
                );
                restBlock.append(...nextChildren);
                leftBlock.insertAfter(restBlock);
                console.log(
                  "$ not collapsed -> startpoint -> element -> inline node -> does have next"
                );
              } else {
                let restBlock = leftBlock.getNextSibling();
                console.log(
                  "$ not collapsed -> startpoint -> element -> inline node -> does NOT have next"
                );
              }
            } else {
              console.log(
                "$ not collapsed -> startpoint -> element -> NO inline node"
              );
            }
          }
        }

        // remove blocks between left and right
        console.log("$ REMOVING");
        let next = leftBlock
          ? leftBlock.getNextSibling()
          : $getRoot().getFirstChild()!;
        while (next && next.__key !== rightBlock?.__key) {
          console.log("$ remove", next);
          let toBeRemoved = next;
          next = next.getNextSibling();
          toBeRemoved.remove();
        }
      }

      console.log("$ RESULT", {
        left: {
          block: leftBlock,
          inlines: leftBlock?.getChildren?.(),
        },
        right: {
          block: rightBlock,
          inlines: rightBlock?.getChildren?.(),
        },
        root: $getRoot().getChildren(),
      });

      let select = {
        type: "element",
        offset: -1,
        node: newBlocks[newBlocks.length - 1],
      };

      if (
        !blockLeftMerge &&
        $isTextBlockNode(leftBlock) &&
        $isTextBlockNode(newBlocks[0])
      ) {
        select = merge(leftBlock, newBlocks[0], { cursor: "right" });
        newBlocks.shift();

        console.log("$ MERGE LEFT", {
          left: {
            block: leftBlock,
            inlines: leftBlock?.getChildren?.(),
          },
          right: {
            block: rightBlock,
            inlines: rightBlock?.getChildren?.(),
          },
          root: $getRoot().getChildren(),
        });
      }

      if (!blockRightMerge && $isTextBlockNode(rightBlock)) {
        let lastNewParagraph: ParagraphNode | null = null;
        let lastNew = newBlocks[newBlocks.length - 1]; // possibly undefined

        if ($isTextBlockNode(lastNew)) {
          lastNewParagraph = lastNew;
          newBlocks.pop();
        } else if (lastNew === undefined && $isTextBlockNode(leftBlock)) {
          lastNewParagraph = leftBlock;
        }

        if (lastNewParagraph) {
          select = merge(lastNewParagraph, rightBlock, {
            keep: "right",
          });

          console.log("$ MERGE RIGHT", {
            left: {
              block: leftBlock,
              inlines: leftBlock?.getChildren?.(),
            },
            right: {
              block: rightBlock,
              inlines: rightBlock?.getChildren?.(),
            },
            root: $getRoot().getChildren(),
          });
        }
      }

      if (newBlocks.length > 0) {
        if (leftBlock) {
          console.log("$ inserting after left block");
          insertAfter(leftBlock, newBlocks);
        } else if (rightBlock) {
          console.log("$ inserting before right block");
          insertBefore(rightBlock, newBlocks);
        } else {
          console.log("$ inserting in root");
          $getRoot().append(...newBlocks);
        }
      } else {
        console.log("$ no new blocks");
      }

      if (leftBlock && leftBlock.getChildrenSize?.() === 0) {
        leftBlock.remove();
      }
      if (rightBlock && rightBlock.getChildrenSize?.() === 0) {
        rightBlock.remove();
      }

      if (select.type === "element") {
        const next = select.node.getNextSibling();
        const parent = select.node.getParent();
        if ($isTextNode(next)) {
          next.select(0, 0);
        } else if ($isTextBlockNode(parent)) {
          const index = (
            select.node as DecoratorNode<any>
          ).getIndexWithinParent();
          parent.select(index + 1, index + 1);
        } else {
          select.node.selectNext(0, 0);
        }
      } else {
        (select.node as TextNode).select(select.offset, select.offset);
      }
    } else if ($isNodeSelection(selection)) {
      console.log("$ NODE SELECTION", selection);
    }
  } catch (err) {
    console.log("$ ERROR");
    console.error(err);
  }
}

export function replaceWithComputation(
  editor: LexicalEditor,
  insert: TokenStream,
  libraries: LibraryConfig[]
) {
  editor.update(() => {
    const newBlocks = $getBlocksFromComputation(insert, libraries);
    return $replaceWithBlocks(editor, newBlocks);
  });
}

/*
export async function insertComputation(
  editor: LexicalEditor,
  insert: TokenStream,
  libraries: LibraryConfig[]
) {
  return await new Promise<boolean>((resolve) => {
    editor.update(() => {
      const selection = $getSelection();

      console.log("SELECTION", selection);

      if ($isRangeSelection(selection)) {
        const [startPoint, endPoint] = $getStartAndEnd(selection);
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
            ? $createParagraphNode().append(textNode)
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
          node = node.spliceText(startPoint.offset, remove, insert[0], true);

          if (node.getTextContent() === "") {
            node.remove();
          }
        } else {
          try {
            spliceTextWithNodes(
              node,
              startPoint.offset,
              remove,
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
}
*/
