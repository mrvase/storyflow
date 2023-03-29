import { $createRangeSelection as _create, TextNode } from "lexical";

export default function $createRangeSelection(
  anchor: { node: TextNode; offset: number; type?: "element" | "text" },
  focus: { node: TextNode; offset: number; type?: "element" | "text" }
) {
  const selection = _create();

  selection.anchor.set(
    anchor.node.getKey(),
    anchor.offset,
    anchor.type ?? "text"
  );
  selection.focus.set(focus.node.getKey(), focus.offset, focus.type ?? "text");

  /*
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
  */

  return selection;
}
