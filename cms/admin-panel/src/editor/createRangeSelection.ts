import { $createRangeSelection as _create, TextNode } from "lexical";

export default function $createRangeSelection(
  anchor: { node: TextNode; offset: number },
  focus: { node: TextNode; offset: number }
) {
  const selection = _create();

  Object.assign(selection.anchor, {
    type: "text",
    offset: anchor.offset,
    key: anchor.node.getKey(),
  });

  Object.assign(selection.focus, {
    type: "text",
    offset: focus.offset,
    key: focus.node.getKey(),
  });

  return selection;
}
