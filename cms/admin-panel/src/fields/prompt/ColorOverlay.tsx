import React from "react";
import cl from "clsx";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { ColorPicker } from "../../elements/ColorPicker/ColorPicker";
import ColorNode from "../Editor/decorators/ColorNode";
import { Options } from "./OptionsContext";
import { $createBlocksFromStream } from "../Editor/transforms";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { useClientConfig } from "../../client-config";

export function ColorOverlay({ node }: { node?: ColorNode }) {
  const editor = useEditorContext();

  const initialColor = React.useMemo(
    () => node?.__token?.color ?? "#ffffff",
    [node]
  );

  const [color, setColor] = React.useState(initialColor);
  const [results, setResults] = React.useState([initialColor]);

  React.useEffect(() => {
    setColor(initialColor);
    setResults([initialColor]);
  }, [node]);

  const { libraries } = useClientConfig();

  const handleResult = React.useCallback(() => {
    setResults((prev) => [color, ...prev.slice(0, 7)]);
    editor.update(() => {
      if (node) {
        node.setToken({ color });
      } else {
        const blocks = $createBlocksFromStream([{ color }], libraries);
        $replaceWithBlocks(blocks);
      }
    });
  }, [color, node, editor, libraries]);

  const isNewColor = color !== results[0];

  return (
    <div className="p-2.5">
      <Options>
        <ColorPicker
          color={color}
          onChange={setColor}
          onEnd={handleResult}
          className="w-full rounded"
        />
      </Options>
      <div className="flex mt-2.5">
        <div className="flex gap-1.5">
          {isNewColor && (
            <div
              className="h-8 w-8 rounded"
              style={{ backgroundColor: color }}
            />
          )}
          {results.map((color, index) =>
            !(isNewColor && index === 7) ? (
              <div
                key={`${color}-${index}`}
                className={cl(
                  "h-8 w-8",
                  "rounded"
                  // isNewColor && index === 0 ? "rounded-r" : "rounded"
                )}
                style={{ backgroundColor: color }}
              />
            ) : null
          )}
        </div>
        <div className="ml-auto h-8 flex items-center">
          {color.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
