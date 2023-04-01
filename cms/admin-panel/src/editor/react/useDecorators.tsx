/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { $getNodeByKey, LexicalEditor } from "lexical";

import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { ErrorBoundary } from "react-error-boundary";
import useLayoutEffect from "./useLayoutEffect";

const ErrorFallback = () => {
  return <span className="bg-red-800 text-red-100">SOMETHING WENT WRONG</span>;
};

export function useDecorators(editor: LexicalEditor): Array<JSX.Element> {
  const [decorators, setDecorators] = useState<Record<string, JSX.Element>>(
    () => editor.getDecorators<JSX.Element>()
  );

  // Subscribe to changes
  useLayoutEffect(() => {
    return editor.registerDecoratorListener<JSX.Element>((nextDecorators) => {
      ReactDOM.flushSync(() => {
        setDecorators(nextDecorators);
      });
    });
  }, [editor]);

  useEffect(() => {
    // If the content editable mounts before the subscription is added, then
    // nothing will be rendered on initial pass. We can get around that by
    // ensuring that we set the value.
    setDecorators(editor.getDecorators());
  }, [editor]);

  // Return decorators defined as React Portals
  return useMemo(() => {
    const decoratedPortals = [];
    const decoratorKeys = Object.keys(decorators);

    for (let i = 0; i < decoratorKeys.length; i++) {
      const nodeKey = decoratorKeys[i];
      const reactDecorator = (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(e) => editor._onError(e)}
        >
          {decorators[nodeKey]}
        </ErrorBoundary>
      );
      const element = editor.getElementByKey(nodeKey);

      if (element !== null) {
        decoratedPortals.push(ReactDOM.createPortal(reactDecorator, element));
      }
    }

    return decoratedPortals;
  }, [decorators, editor]);
}
