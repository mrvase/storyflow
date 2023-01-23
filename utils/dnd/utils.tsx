import React from "react";
import { getFrame } from "./typeGuards";
import type { Rect } from "./types";

export const translateRect = <
  T extends Rect,
  U extends { left: number; top: number }
>(
  obj1: T,
  obj2: U
): T => {
  return {
    ...obj1,
    left: obj1.left + obj2.left,
    right: obj1.right + obj2.left,
    top: obj1.top + obj2.top,
    bottom: obj1.bottom + obj2.top,
  };
};

export function getBoundingClientRect<Element extends HTMLElement>(
  ref: React.MutableRefObject<Element | null>
) {
  if (!ref.current) {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
    };
  }
  const frameRect = getFrame(ref.current)?.getBoundingClientRect?.() ?? {
    left: 0,
    top: 0,
  };

  const rect = ref.current?.getBoundingClientRect();

  return translateRect(
    {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      height: rect.height,
      width: rect.width,
      isShadow: false,
    },
    frameRect
  );
}

export const createKey = () => {
  return Math.random().toString(36).slice(2, 10);
};
