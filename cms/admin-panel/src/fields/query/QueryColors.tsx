import cl from "clsx";
import { ArrowUturnRightIcon, CubeIcon } from "@heroicons/react/24/outline";
import React from "react";
import { ColorPicker } from "../../elements/ColorPicker/ColorPicker";
import { hexToRgba } from "../../elements/ColorPicker/convert";
import useSWR from "swr";
import { getColorName } from "../../data/colors";
import { Option as OptionComponent, useOptionEvents } from "./Option";
import {
  ColorToken,
  CustomToken,
  TokenStream,
  Token,
} from "@storyflow/backend/types";
import { Option } from "@storyflow/frontend/types";

const isColorLight = (color: string) => {
  const rgb = hexToRgba(color);
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 127;
};

export function QueryColors({
  insertComputation,
  selected,
  setToken,
  initialColor,
  options = [],
}: {
  query: string;
  insertComputation: (comp: TokenStream) => void;
  selected: number;
  setToken?: (value: Token) => void;
  initialColor?: string;
  options?: readonly Option[];
}) {
  const [color, setColor] = React.useState(initialColor || "#ffffff");
  const [hoverColor, setHoverColor] = React.useState<string>();
  const selectedColor = color;

  const { data } = useSWR("COLORS", {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });

  let label = "";

  if (data) {
    label += getColorName(selectedColor.slice(1), data[0], data[1]);
  }

  const onEnter = React.useCallback(
    (option: Option) => {
      let token: CustomToken | ColorToken;
      if (typeof option === "object" && "name" in option && option.name) {
        token = { name: option.name };
      } else {
        token = { color: getColor(option) };
      }
      if (setToken) {
        setToken(token);
      } else {
        insertComputation([token]);
      }
    },
    [insertComputation, setToken]
  );

  const current = selected < 0 ? selected : selected % (1 + options.length);

  const isLight = isColorLight(selectedColor);

  return (
    <>
      <OptionComponent
        value={color}
        onEnter={onEnter}
        isSelected={current === 0}
        Icon={CubeIcon}
        secondaryText={`${label} (${selectedColor})`}
        style={{
          backgroundColor: selectedColor,
          color: isLight ? "rgba(0 0 0 / 90%)" : "rgba(255 255 255 / 90%)",
        }}
      >
        Indsæt farve
      </OptionComponent>
      <div
        className={cl(
          "p-1 rounded hover:ring-1 ring-gray-600 ring-inset",
          current === 0 && "bg-gray-700"
        )}
      >
        <ColorPicker
          color={color}
          onChange={setColor}
          className="w-full max-w-xl mx-auto rounded"
        />
      </div>
      <div
        className="flex gap-1"
        onMouseLeave={() => {
          setHoverColor(undefined);
        }}
      >
        {options.map((color: any, i: number) => (
          <ColorOption
            isSelected={current === i + 1}
            onEnter={onEnter}
            value={color}
          />
        ))}
      </div>
      {/*<div className="flex justify-between text-gray-400 text-sm select-text">
              <span
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  navigator.clipboard.writeText(label);
                }}
              >
                {label}
              </span>
              <span
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  navigator.clipboard.writeText(color);
                }}
              >
                {color}
              </span>
              </div>*/}
    </>
  );
}

const getColor = (value: Option) => {
  return typeof value === "object" &&
    "value" in value &&
    typeof value.value === "string"
    ? value.value
    : typeof value === "string"
    ? value
    : "#ffffff";
};

function ColorOption({
  isSelected,
  onEnter,
  value,
}: {
  isSelected: boolean;
  onEnter: (value: Option) => void;
  value: Option;
}) {
  const color = getColor(value);

  const { onClick } = useOptionEvents({ isSelected, onEnter, value });

  return (
    <div
      className={cl(
        "w-10 h-10 p-1 rounded hover:ring-1 ring-gray-600 ring-inset",
        isSelected && "bg-gray-700"
      )}
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={onClick}
    >
      <div
        className="w-8 h-8 rounded-sm flex-center"
        style={{
          backgroundColor: color,
          color: isColorLight(color)
            ? "rgba(0 0 0 / 90%)"
            : "rgba(255 255 255 / 90%)",
        }}
      >
        {isSelected && <ArrowUturnRightIcon className="w-4 h-4 rotate-180" />}
      </div>
    </div>
  );
}
