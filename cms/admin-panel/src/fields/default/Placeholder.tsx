import React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { useIsEmpty } from "../../editor/react/useIsEmpty";
import { useIsFocused } from "../../editor/react/useIsFocused";

export function Placeholder() {
  const editor = useEditorContext();
  const isFocused = useIsFocused();
  const isEmpty = useIsEmpty(editor);
  return isEmpty ? (
    <div className="absolute pointer-events-none text-gray-400 dark:text-gray-500 select-none p-2.5 pt-1.5">
      {isFocused ? 'Skriv "/" for genveje' : "Ikke udfyldt"}
    </div>
  ) : null;
}
