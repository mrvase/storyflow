import React from "react";
import { hexToHsva, hsvaToHex } from "./convert";
import { HsvaColor } from "./types";
import { equalColorObjects, equalHex, useEventCallback } from "./utils";

export function useColorManipulation(
  color: string,
  onChange?: (color: string) => void
): [HsvaColor, (color: Partial<HsvaColor>) => void] {
  // Save onChange callback in the ref for avoiding "useCallback hell"
  const onChangeCallback = useEventCallback(onChange);

  // No matter which color model is used (HEX, RGB(A) or HSL(A)),
  // all internal calculations are based on HSVA model
  const [hsva, updateHsva] = React.useState<HsvaColor>(() => hexToHsva(color));

  // By using this ref we're able to prevent extra updates
  // and the effects recursion during the color conversion
  const cache = React.useRef({ color, hsva });

  // Update local HSVA-value if `color` property value is changed,
  // but only if that's not the same color that we just sent to the parent
  React.useEffect(() => {
    if (!equalHex(color, cache.current.color)) {
      const newHsva = hexToHsva(color);
      cache.current = { hsva: newHsva, color };
      updateHsva(newHsva);
    }
  }, [color]);

  // Trigger `onChange` callback only if an updated color is different from cached one;
  // save the new color to the ref to prevent unnecessary updates
  React.useEffect(() => {
    let newColor;
    if (
      !equalColorObjects(hsva, cache.current.hsva) &&
      !equalHex((newColor = hsvaToHex(hsva)), cache.current.color)
    ) {
      cache.current = { hsva, color: newColor };
      onChangeCallback(newColor);
    }
  }, [hsva, onChangeCallback]);

  // Merge the current HSVA color object with updated params.
  // For example, when a child component sends `h` or `s` only
  const handleChange = React.useCallback((params: Partial<HsvaColor>) => {
    updateHsva((current) => Object.assign({}, current, params));
  }, []);

  return [hsva, handleChange];
}
