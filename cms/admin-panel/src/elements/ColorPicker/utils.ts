import React from "react";
import { hexToRgba } from "./convert";
import { HsvaColor, RgbaColor } from "./types";

export const clamp = (number: number, min = 0, max = 1): number => {
  return number > max ? max : number < min ? min : number;
};

export function useEventCallback<T>(
  handler?: (value: T) => void
): (value: T) => void {
  const callbackRef = React.useRef(handler);
  const fn = React.useRef((value: T) => {
    callbackRef.current && callbackRef.current(value);
  });
  callbackRef.current = handler;

  return fn.current;
}

export const round = (
  number: number,
  digits = 0,
  base = Math.pow(10, digits)
): number => {
  return Math.round(base * number) / base;
};

export const equalColorObjects = (
  first: HsvaColor | RgbaColor,
  second: HsvaColor | RgbaColor
): boolean => {
  if (first === second) return true;

  for (const prop in first) {
    if (
      (first as unknown as Record<string, number>)[prop] !==
      (second as unknown as Record<string, number>)[prop]
    )
      return false;
  }

  return true;
};

export const equalHex = (first: string, second: string): boolean => {
  if (first.toLowerCase() === second.toLowerCase()) return true;

  // To compare colors like `#FFF` and `ffffff` we convert them into RGB objects
  return equalColorObjects(hexToRgba(first), hexToRgba(second));
};
