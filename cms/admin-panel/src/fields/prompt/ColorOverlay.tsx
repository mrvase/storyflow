import React from "react";
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
