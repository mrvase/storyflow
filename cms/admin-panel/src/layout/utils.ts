import { useLocation, useNavigate } from "@storyflow/router";
import React from "react";

export const trimLeadingSlash = (el: string) => el.replace(/^\/+/, "");
export const trimTrailingSlash = (el: string) => el.replace(/\/+$/, "");
export const trimSlashes = (el: string) =>
  trimTrailingSlash(trimLeadingSlash(el));

export const getSubSegments = (url: string) => {
  url = trimTrailingSlash(url);
  return url
    .split(/(\/[^\/]+)/g)
    .filter((el) => el !== "")
    .map((el, index, arr) => {
      return arr.slice(0, index + 1).join("");
    });
};

export const getPathFromSegment = (url: string) => url.replace(/^\/~\d+/, "");

const splitTabUrl = (pathname: string) => {
  pathname = trimSlashes(pathname);

  if (!pathname.includes("/")) {
    return [pathname, "/~1"];
  }

  if (pathname.startsWith("~")) {
    return ["", `/${pathname}`];
  }

  let [org, tabUrl] = [
    pathname.substring(0, pathname.indexOf("/")),
    pathname.substring(pathname.indexOf("/")),
  ];

  tabUrl = [undefined, ""].includes(tabUrl) ? "/~1" : tabUrl;

  return [org, tabUrl];
};

export const useTabUrl = (): [
  string,
  (url: string, options?: { close?: boolean; navigate?: boolean }) => string
] => {
  const navigate = useNavigate();
  let { pathname } = useLocation();

  let [org, tabUrl] = splitTabUrl(pathname);

  const navigateTab = React.useCallback(
    (
      segment: string,
      {
        close = false,
        navigate: navigateOption = true,
      }: { close?: boolean; navigate?: boolean } = {}
    ) => {
      const url = `${org ? "/" : ""}${org}${tabUrl}`;

      const id = segment.match(/^\/~\d+/)?.[0];

      if (id === undefined) {
        console.warn(
          `Navigation failed: A segment identifier (e.g. "/~1") does not start the segment: ${segment}`
        );
        return "";
      }

      const index = url.match(id)?.index;

      if (index === undefined) {
        const result = `${url}${segment}`;
        if (navigateOption) navigate(result);
        return result;
      }

      const oldSegment = trimTrailingSlash(
        url.match(new RegExp(`${id}[^~]*`))?.[0]!
      );

      const result = url.replace(oldSegment, close ? "" : segment);

      if (navigateOption) navigate(result);

      return result;
    },
    [pathname]
  );

  return [tabUrl, navigateTab];
};
