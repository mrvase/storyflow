import React from "react";
import cl from "clsx";
import { Interaction, Interactive } from "./Interactive";
import { Pointer } from "./Pointer";
import { hsvaToHex, hsvaToHslString } from "./convert";
import { HsvaColor } from "./types";
import { clamp, round } from "./utils";
import { useColorManipulation } from "./useColorManipulation";

const SaturationBase = ({
  hsva,
  onChange,
  onEnd,
}: {
  hsva: HsvaColor;
  onChange: (newColor: { s: number; v: number }) => void;
  onEnd?: (newColor: { s: number; v: number }) => void;
}) => {
  const handleMove = (interaction: Interaction) => {
    onChange({
      s: interaction.left * 100,
      v: 100 - interaction.top * 100,
    });
  };

  const handleMoveEnd = (interaction: Interaction) => {
    onEnd?.({
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
      className="saturation relative w-full h-32 rounded-l-sm -mr-1 shadow-lg"
    >
      <Interactive
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
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
  onEnd,
}: {
  hue: number;
  onChange: (newHue: { h: number }) => void;
  onEnd?: (newHue: { h: number }) => void;
}) => {
  const handleMove = (interaction: Interaction) => {
    onChange({ h: 360 * interaction.top });
  };

  const handleMoveEnd = (interaction: Interaction) => {
    onEnd?.({ h: 360 * interaction.top });
  };

  const handleKey = (offset: Interaction) => {
    // Hue measured in degrees of the color circle ranging from 0 to 360
    onChange({
      h: clamp(hue + offset.top * 360, 0, 360),
    });
  };

  return (
    <div className="relative w-8 h-32 hue rounded-sm ring-1 ring-inset ring-white/25">
      <Interactive
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onKey={handleKey}
        aria-label="Hue"
        aria-valuenow={round(hue)}
        aria-valuemax="360"
        aria-valuemin="0"
      >
        <Pointer
          top={hue / 360}
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
  onEnd,
  className,
}: {
  color: string;
  onChange: (value: string) => void;
  onEnd?: (value: string) => void;
  className?: string;
}): JSX.Element => {
  const [hsva, updateHsva] = useColorManipulation(color, onChange);

  const handleEnd = React.useCallback(() => {
    onEnd?.(hsvaToHex(hsva));
  }, [onEnd, hsva]);

  return (
    <div className={cl("flex", className)}>
      <Saturation hsva={hsva} onChange={updateHsva} onEnd={handleEnd} />
      <Hue hue={hsva.h} onChange={updateHsva} onEnd={handleEnd} />
    </div>
  );
};
