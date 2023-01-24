import * as React from "react";
import { useEditorContext } from "./EditorProvider";
import { useIsEditable } from "./useIsEditable";

export function ContentEditable(
  props: Omit<React.ComponentProps<"div">, "contentEditable">
): JSX.Element {
  const editor = useEditorContext();

  const ref = React.useCallback(
    (rootElement: null | HTMLElement) => {
      editor.setRootElement(rootElement);
    },
    [editor]
  );

  const isEditable = useIsEditable();

  return <div {...props} contentEditable={isEditable} ref={ref} />;
}
