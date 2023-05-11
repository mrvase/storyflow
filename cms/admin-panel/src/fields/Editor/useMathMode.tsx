import * as React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import type { TokenStream } from "../../operations/types";
import { useAppConfig } from "../../AppConfigContext";
import { operators } from "@storyflow/shared/types";
import { replaceWithComputation } from "./insertComputation";

export function useMathMode(defaultValue: boolean = false) {
  const editor = useEditorContext();

  const state = React.useState(defaultValue);
  const [mathMode] = state;

  React.useEffect(() => {
    state[1](defaultValue);
  }, [defaultValue]);

  const { configs } = useAppConfig();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      /*
      const computation = editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isSelection(selection)) {
          return [];
        }
        let [anchor] = $getIndexesFromSelection(selection);
 
        const strean = $getComputation($getRoot());
 
        return tools.slice(stream, 0, anchor);
      });
 
      const numberOpeners: number[] = [];
      const numberClosers: number[] = [];
      const textOpeners: number[] = [];
      const textClosers: number[] = [];
 
      computation.forEach((el, index) => {
        if (symb.isSymbol(el, "(")) {
          numberOpeners.push(index);
        } else if (symb.isSymbol(el, ")")) {
          numberClosers.push(index);
        } else if (symb.isSymbol(el, "(")) {
          textOpeners.push(index);
        } else if (symb.isSymbol(el, ")")) {
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
      const insert = (stream: TokenStream) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        replaceWithComputation(editor, stream, configs);
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
        if (event.key === "*") {
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
  }, [editor, configs, mathMode]);

  return state;
}
