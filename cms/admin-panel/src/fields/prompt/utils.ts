import type { LibraryConfig } from "@storyflow/shared/types";
import { $getSelection, $isRangeSelection } from "lexical";
import PromptNode, { $isPromptNode } from "../Editor/decorators/PromptNode";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { $createBlocksFromStream } from "../Editor/transforms";

export const $getPromptNode = () => {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return;
  }

  return selection
    .getNodes()
    .find((node): node is PromptNode => $isPromptNode(node));
};

export const $exitPromptNode = (
  libraries: LibraryConfig[],
  node_?: PromptNode
) => {
  const node = node_ ?? $getPromptNode();

  if (!node) {
    return;
  }

  const stream = node.getTokenStream();
  if (stream.length) {
    node.select(0);
    $replaceWithBlocks($createBlocksFromStream(stream, libraries));
  } else {
    node.remove();
  }
};
