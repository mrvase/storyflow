import { mergeRegister } from "@lexical/utils";
import {
  KEY_ESCAPE_COMMAND,
  COMMAND_PRIORITY_HIGH,
  BLUR_COMMAND,
  $setSelection,
} from "lexical";
import React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { ColorPicker } from "../../elements/ColorPicker/ColorPicker";
import { Options } from "./OptionsContext";

export function ColorOverlay() {
  const [color, setColor] = React.useState("#ffffff");
  return (
    <div className="p-2.5">
      <Options>
        <ColorPicker
          color={color}
          onChange={setColor}
          className="w-full rounded"
        />
      </Options>
    </div>
  );
}
