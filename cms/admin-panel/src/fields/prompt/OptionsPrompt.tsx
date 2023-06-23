import React from "react";
import { Option } from "./Option";
import { Option as OptionType } from "@storyflow/shared/types";
import { useEditorContext } from "../../editor/react/EditorProvider";
import CustomTokenNode, {
  $isCustomTokenNode,
} from "../Editor/decorators/CustomTokenNode";
import { $createBlocksFromStream } from "../Editor/transforms";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { useAppConfig } from "../../AppConfigContext";
import { $createParagraphNode, $createTextNode } from "lexical";

export function OptionsPrompt({
  options,
  node,
}: {
  options: OptionType[];
  node?: CustomTokenNode;
}) {
  const editor = useEditorContext();
  const { configs } = useAppConfig();

  const handleCustomResult = React.useCallback(
    (option: OptionType) => {
      editor.update(() => {
        if (option.alias) {
          const name = option.alias;
          if (node && $isCustomTokenNode(node)) {
            node.setToken({ name });
          } else {
            const blocks = $createBlocksFromStream([{ name }], configs);
            $replaceWithBlocks(blocks);
          }
        } else {
          const p = $createParagraphNode();
          p.append($createTextNode(String(option.value)));
          $replaceWithBlocks([p]);
        }
      });
    },
    [node, editor, configs]
  );
  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">Muligheder</div>
      {options.map((el) => (
        <Option key={el.value} value={el} onEnter={handleCustomResult}>
          {el.label ?? el.alias ?? el.value}
        </Option>
      ))}
    </div>
  );
}
