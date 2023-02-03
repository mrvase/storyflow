import {
  LibraryConfig,
  RenderArray,
  ValueArray,
} from "@storyflow/frontend/types";
import { getConfigByType } from "./getConfigByType";

const isRenderable = (
  el: any
): el is string | number | { id: string; type: string } => {
  if (el === "") return false;
  return (
    ["string", "number"].includes(typeof el) ||
    (typeof el === "object" && "type" in el)
  );
};

const isHeadingElement = (el: any): number => {
  return typeof el === "string"
    ? (el.match(/^(\#+)\s.+/)?.[1] ?? "").length
    : 0;
};

const isInlineElement = (
  el: any,
  configs: LibraryConfig[]
): el is string | number | { id: string; type: string } => {
  if (["string", "number"].includes(typeof el)) {
    return true;
  }
  if (typeof el === "object" && "type" in el) {
    if (el.type === "Link") return true;
    return Boolean(getConfigByType(el.type, configs)?.inline);
  }
  return false;
};

export const createRenderArray = (
  value: ValueArray,
  configs: LibraryConfig[]
) => {
  console.log("CONFIG", value, configs);
  return value.reduce((a, c) => {
    if (!isRenderable(c)) {
      return a;
    }
    const heading = isHeadingElement(c);
    if (heading > 0) {
      a.push({ $heading: [heading, (c as string).substring(heading + 1)] });
      return a;
    }
    if (!isInlineElement(c, configs)) {
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
  }, [] as RenderArray);
};
