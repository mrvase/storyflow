import type { ValueArray } from "@storyflow/shared/types";
import type { RenderArray, RenderElement } from "./types";

export const isRenderable = (
  el: any
): el is string | number | { id: string; element: string } => {
  // if (el === "") return false;
  return (
    ["string", "number"].includes(typeof el) ||
    (typeof el === "object" && "element" in el)
  );
};

export const isHeadingElement = (el: any): number => {
  return typeof el === "string"
    ? (el.match(/^(\#+)\s.+/)?.[1] ?? "").length
    : 0;
};

export const isInlineElement = (
  el: any,
  getDisplayType: (type: string) => boolean
): el is string | number | { id: string; type: string } => {
  if (["string", "number"].includes(typeof el)) {
    return true;
  }
  if (typeof el === "object" && "element" in el) {
    if (el.element === "Link") return true;
    return getDisplayType(el.element);
  }
  return false;
};

export function createRenderArray(
  value: ValueArray,
  getDisplayType: (type: string) => boolean,
  nested?: false
): RenderArray;
export function createRenderArray(
  value: ValueArray,
  getDisplayType: (type: string) => boolean,
  nested: true
): RenderElement[];
export function createRenderArray(
  value: ValueArray,
  getDisplayType: (type: string) => boolean,
  nested: boolean = false
) {
  return value.reduce((a, c) => {
    if (Array.isArray(c)) {
      const children = createRenderArray(c, getDisplayType, true);
      (a as RenderArray).push(
        ...(!nested ? [{ $children: children }] : children)
      );
      return a;
    }
    if (!isRenderable(c)) {
      return a;
    }
    const heading = isHeadingElement(c);
    if (heading > 0) {
      a.push({ $heading: [heading, (c as string).substring(heading + 1)] });
      return a;
    }
    if (!isInlineElement(c, getDisplayType)) {
      a.push(c);
      return a;
    }
    let prev = a[a.length - 1];
    if (
      typeof prev === "object" &&
      "$text" in prev &&
      !(
        typeof prev.$text[prev.$text.length - 1] === "string" &&
        typeof c === "string"
      )
    ) {
      prev.$text.push(c);
      return a;
    }
    a.push({
      $text: [c],
    });
    return a;
  }, [] as RenderArray | RenderElement[]);
}
