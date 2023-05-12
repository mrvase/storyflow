import { createKey } from "../../utils/createKey";
import { trimSlashes } from "../../utils/trimSlashes";
import type { Panels } from "./types";

export const normalizeUrl = (url: string) => {
  const [prefix, ...panelPath] = url.split(/\/~/); // splits only at first occurrence
  return [`/${trimSlashes(prefix)}`, `/~${panelPath.join("/~")}`] as [
    string,
    string
  ];
};

export const getPanelsFromUrl = (url: string): Panels => {
  const [prefix, panelPath] = normalizeUrl(url);

  const paths = panelPath.split(/\/\~/g).slice(1);

  return {
    prefix,
    data: paths.map((el, index) => {
      return {
        key: createKey(),
        path: el || "/",
        index,
      };
    }),
  };
};

export const getUrlFromPanels = ({ prefix, data }: Panels): string => {
  return `${prefix}${data
    .slice()
    .sort((a, b) => a.index - b.index)
    .reduce((a, c) => a + `/~${c.path === "/" ? "" : c.path}`, "")}`;
};

export const replacePanelPath = (
  pathname: string,
  next: { index: number; path: string }
) => {
  const panels = getPanelsFromUrl(pathname);
  panels.data[next.index].path = next.path;
  return getUrlFromPanels(panels);
};
