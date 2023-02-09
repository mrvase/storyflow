import * as React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { ComputationOp } from "shared/operations";
import { EditorComputation } from "@storyflow/backend/types";
import { useClientConfig } from "../../client-config";
import { operators } from "@storyflow/backend/types";
import { insertComputation } from "./insertComputation";

export function useMathMode(defaultValue: boolean = false) {
  const editor = useEditorContext();

  const state = React.useState(defaultValue);
  const [mathMode] = state;

  React.useEffect(() => {
    state[1](defaultValue);
  }, [defaultValue]);

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
        insertComputation(editor, compute, libraries);
      };

      if (mathMode) {
        if (operators.includes(event.key as any)) {
          insert([{ _: event.key as "*" }]);
        } else if (event.key === ",") {
          insert([{ ",": true }]);
        } else if ("xyz".indexOf(event.key) >= 0) {
          insert([{ x: "xyz".indexOf(event.key) }]);
        } else if (event.key === "(") {
          insert([{ "(": true }]);
        } else if (event.key === "[") {
          insert([{ "[": true }]);
        } else if (event.key === ")") {
          insert([{ ")": true }]);
        } else if (event.key === "]") {
          insert([{ "]": true }]);
        }
      } else {
        if (!mathMode && event.key === "*") {
          insert([`\\*`]);
        }
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
