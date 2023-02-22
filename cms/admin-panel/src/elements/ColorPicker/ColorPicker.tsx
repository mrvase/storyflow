import React from "react";
import { Interaction, Interactive } from "./Interactive";
import { Pointer } from "./Pointer";
import { hsvaToHslString } from "./convert";
import { HsvaColor } from "./types";
import { clamp, round } from "./utils";
import { useColorManipulation } from "./useColorManipulation";

const SaturationBase = ({
  hsva,
  onChange,
}: {
  hsva: HsvaColor;
  onChange: (newColor: { s: number; v: number }) => void;
}) => {
  const handleMove = (interaction: Interaction) => {
    onChange({
      s: interaction.left * 100,
      v: 100 - interaction.top * 100,
    });
  };

  const handleKey = (offset: Interaction) => {
    // Saturation and brightness always fit into [0, 100] range
    onChange({
      s: clamp(hsva.s + offset.left * 100, 0, 100),
      v: clamp(hsva.v - offset.top * 100, 0, 100),
    });
  };

  return (
    <div
      style={{
        backgroundColor: hsvaToHslString({ h: hsva.h, s: 100, v: 100, a: 1 }),
      }}
      className="saturation relative w-full h-32 rounded-t"
    >
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        aria-label="Color"
        aria-valuetext={`Saturation ${round(hsva.s)}%, Brightness ${round(
          hsva.v
        )}%`}
      >
        <Pointer
          top={1 - hsva.v / 100}
          left={hsva.s / 100}
          color={hsvaToHslString(hsva)}
        />
      </Interactive>
    </div>
  );
};

const HueBase = ({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (newHue: { h: number }) => void;
}) => {
  const handleMove = (interaction: Interaction) => {
    onChange({ h: 360 * interaction.left });
  };

  const handleKey = (offset: Interaction) => {
    // Hue measured in degrees of the color circle ranging from 0 to 360
    onChange({
      h: clamp(hue + offset.left * 360, 0, 360),
    });
  };

  return (
    <div className="relative w-full h-8 hue rounded-b">
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        aria-label="Hue"
        aria-valuenow={round(hue)}
        aria-valuemax="360"
        aria-valuemin="0"
      >
        <Pointer
          left={hue / 360}
          color={hsvaToHslString({ h: hue, s: 100, v: 100, a: 1 })}
        />
      </Interactive>
    </div>
  );
};

const Hue = React.memo(HueBase);
const Saturation = React.memo(SaturationBase);

export const ColorPicker = ({
  color = "#fff",
  onChange,
}: {
  color: string;
  onChange: (value: string) => void;
}): JSX.Element => {
  const [hsva, updateHsva] = useColorManipulation(color, onChange);

  return (
    <div className="w-full flex flex-col rounded border-1 border-white">
      <Saturation hsva={hsva} onChange={updateHsva} />
      <Hue hue={hsva.h} onChange={updateHsva} />
    </div>
  );
};
