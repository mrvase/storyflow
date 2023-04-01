import { useEditorContext } from "../../editor/react/EditorProvider";
import { useDecorators } from "../../editor/react/useDecorators";

export function DecoratorPlugin() {
  const editor = useEditorContext();
  const decorators = useDecorators(editor);

  return <>{decorators}</>;
}
