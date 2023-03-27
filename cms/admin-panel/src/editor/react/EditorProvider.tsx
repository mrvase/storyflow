/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  createEditor,
  EditorThemeClasses,
  Klass,
  LexicalEditor,
  LexicalNode,
} from "lexical";
import * as React from "react";
import { useIsFocused } from "./useIsFocused";
import useLayoutEffect from "./useLayoutEffect";

type Props = {
  children: React.ReactNode;
  initialConfig: Readonly<{
    namespace: string;
    nodes?: ReadonlyArray<Klass<LexicalNode>>;
    onError: (error: Error, editor: LexicalEditor) => void;
    editable?: boolean;
    theme?: EditorThemeClasses;
  }>;
  initialize: () => void;
};

const EditorContext = React.createContext<LexicalEditor | null>(null);
const FocusedContext = React.createContext(false);

export function useEditorContext() {
  const context = React.useContext(EditorContext);

  if (context == null) {
    throw new Error("useEditorContext: cannot find an EditorContext");
  }

  return context;
}

export function useIsFocusedContext() {
  const context = React.useContext(FocusedContext);

  if (context == null) {
    throw new Error("useIsFocusedContext: cannot find an FocusedContext");
  }

  return context;
}

export function EditorProvider({
  initialConfig,
  children,
  initialize,
}: Props): JSX.Element {
  const editor = React.useMemo(() => {
    const { theme, namespace, nodes, onError } = initialConfig;

    const editor = createEditor({
      editable: false,
      namespace,
      nodes,
      onError: (error) => onError(error, editor),
      theme,
    });

    editor.update(
      () => {
        initialize();
      },
      {
        tag: "cms",
      }
    );

    return editor;
  }, []);

  useLayoutEffect(() => {
    const isEditable = initialConfig.editable;
    editor.setEditable(isEditable !== undefined ? isEditable : true);
  }, []);

  const isFocused = useIsFocused(editor);

  return (
    <EditorContext.Provider value={editor}>
      <FocusedContext.Provider value={isFocused}>
        {children}
      </FocusedContext.Provider>
    </EditorContext.Provider>
  );
}
