import React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { useIsEmpty } from "../../editor/react/useIsEmpty";
import { useIsFocused } from "../../editor/react/useIsFocused";

export function Placeholder() {
  const editor = useEditorContext();
  const isFocused = useIsFocused();
  const isEmpty = useIsEmpty(editor);
  return isEmpty ? (
    <div className="absolute pointer-events-none opacity-25 select-none">
      {isFocused ? 'Skriv "/" for genveje' : "Ikke udfyldt"}
    </div>
  ) : null;
}
