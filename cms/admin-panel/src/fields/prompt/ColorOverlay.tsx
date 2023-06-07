import React from "react";
import cl from "clsx";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { ColorPicker } from "../../elements/ColorPicker/ColorPicker";
import ColorNode from "../Editor/decorators/ColorNode";
import { Options } from "./OptionsContext";
import { $createBlocksFromStream } from "../Editor/transforms";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { useAppConfig } from "../../AppConfigContext";
import { useFieldOptions, useFieldRestriction } from "../FieldIdContext";
import CustomTokenNode, {
  $isCustomTokenNode,
} from "../Editor/decorators/CustomTokenNode";
import { $isColorNode } from "../Editor/decorators/ColorNode";
import { flushSync } from "react-dom";

export function ColorOverlay({ node }: { node?: ColorNode | CustomTokenNode }) {
  const editor = useEditorContext();

  const restrictTo = useFieldRestriction();
  const options = useFieldOptions();

  const initialColor = React.useMemo(() => {
    if (node && $isColorNode(node)) {
      node.__token.color;
    } else if (node && $isCustomTokenNode(node)) {
      return options!.find((el) => el.alias === node.__token.name)!
        .value as string;
    }
    return "#fffff";
  }, [node, options]);

  const [color, setColor] = React.useState(initialColor);
  const [results, setResults] = React.useState([initialColor]);

  const { configs } = useAppConfig();

  const handleColorResult = React.useCallback(
    (color: string) => {
      setResults((prev) => [color, ...prev.slice(0, 7)]);
      editor.update(() => {
        if (node && $isColorNode(node)) {
          node.setToken({ color });
        } else {
          const blocks = $createBlocksFromStream([{ color }], configs);
          $replaceWithBlocks(blocks);
        }
      });
    },
    [node, editor, configs]
  );

  const handleCustomResult = React.useCallback(
    (name: string) => {
      editor.update(() => {
        if (node && $isCustomTokenNode(node)) {
          node.setToken({ name });
        } else {
          const blocks = $createBlocksFromStream([{ name }], configs);
          $replaceWithBlocks(blocks);
        }
      });
    },
    [node, editor, configs]
  );

  const isNewColor = color !== results[0];

  const onEnd = React.useCallback(
    () => handleColorResult(color),
    [handleColorResult, color]
  );

  return (
    <div className="p-2.5">
      <Options>
        <ColorPicker
          color={color}
          onChange={setColor}
          onEnd={onEnd}
          className="w-full rounded"
        />
      </Options>
      <div className="flex mt-2.5">
        <div className="flex gap-1.5">
          {isNewColor && (
            <div
              className="h-8 w-8 rounded"
              style={{ backgroundColor: color }}
              onMouseDown={(ev) => {
                ev.preventDefault();
              }}
            />
          )}
          {results.map((color, index) =>
            !(isNewColor && index === 7) ? (
              <div
                key={`${color}-${index}`}
                className={cl("h-8 w-8 rounded")}
                style={{ backgroundColor: color }}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  handleColorResult(color);
                }}
              />
            ) : null
          )}
        </div>
        <div className="ml-auto h-8 flex items-center">
          {color.toUpperCase()}
        </div>
      </div>
      {restrictTo === "color" && options?.length ? (
        <div className="flex mt-2.5 gap-1.5">
          {options.map((option, index) => (
            <div
              key={`${option.value}-${index}`}
              className={cl("h-8 w-8 rounded")}
              style={{ backgroundColor: option.value as string }}
              onMouseDown={(ev) => {
                ev.preventDefault();
                if (option.alias) {
                  handleCustomResult(option.alias);
                } else {
                  setColor(option.value as string);
                  onEnd();
                }
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
