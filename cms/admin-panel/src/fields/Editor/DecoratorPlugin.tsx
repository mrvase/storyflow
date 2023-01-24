import React from "react";
import { $createImportNode } from "../decorators/ImportNode";
import { $createOperatorNode } from "../decorators/OperatorNode";
import { $createParameterNode } from "../decorators/ParameterNode";
import { registerAutoDecorator } from "../../editor/registerAutoDecorator";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { useDecorators } from "../../editor/react/useDecorators";

export function DecoratorPlugin() {
  const editor = useEditorContext();
  const decorators = useDecorators(editor);

  /*
  React.useEffect(() => {
    return registerAutoDecorator(
      editor,
      (text) => {
        const match = /\{\{[^:}]+:[^}]+\}\}/.exec(text);
        if (!match) {
          return null;
        }
        return {
          start: match.index,
          end: match.index + match[0].length,
        };
      },
      (textNode) => $createImportNode(textNode.getTextContent())
    );
  }, [editor]);

  React.useEffect(() => {
    return registerAutoDecorator(
      editor,
      (text) => {
        const match = /(join|sum|concat)\{\{\(\}\}/.exec(text);
        if (!match) {
          return null;
        }
        return {
          start: match.index,
          end: match.index + match[0].length,
        };
      },
      (textNode) => $createOperatorNode("{{[}}")
    );
  }, [editor]);

  React.useEffect(() => {
    return registerAutoDecorator(
      editor,
      (text) => {
        const match =
          /\{\{(\+|\*|\/|\-|\(|\)|\[|\]|\>|\<|\=|\?|\:|\,)\}\}/.exec(text);
        if (!match) {
          return null;
        }
        return {
          start: match.index,
          end: match.index + match[0].length,
        };
      },
      (textNode) => $createOperatorNode(textNode.getTextContent())
    );
  }, [editor]);

  React.useEffect(() => {
    return registerAutoDecorator(
      editor,
      (text) => {
        const match = /\{\{\d+\}\}/.exec(text);
        if (!match) {
          return null;
        }
        return {
          start: match.index,
          end: match.index + match[0].length,
        };
      },
      (textNode) => $createParameterNode(textNode.getTextContent())
    );
  }, [editor]);
  */

  return <>{decorators}</>;
}
