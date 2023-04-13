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

export const INITIALIZATION_TAG = "initialize";

export function useEditorContext() {
  const context = React.useContext(EditorContext);

  if (context == null) {
    throw new Error("useEditorContext: cannot find an EditorContext");
  }

  return context;
}

export function EditorProvider({
  initialConfig,
  children,
  initialize,
}: Props): JSX.Element {
  const parent = React.useContext(EditorContext);

  const editor = React.useMemo(() => {
    const { theme, namespace, nodes, onError } = initialConfig;

    const editor = createEditor({
      editable: false,
      namespace,
      nodes,
      onError: (error) => onError(error, editor),
      theme,
      parentEditor: parent || undefined,
    });

    editor.update(
      () => {
        initialize();
      },
      {
        tag: INITIALIZATION_TAG,
      }
    );

    return editor;
  }, [parent]);

  useLayoutEffect(() => {
    const isEditable = initialConfig.editable;
    editor.setEditable(isEditable !== undefined ? isEditable : true);
  }, []);

  return (
    <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
  );
}
