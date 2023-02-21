import { useLocation, useNavigate } from "@storyflow/router";
import React from "react";
import { useUrlInfo } from "../users";

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

export const useTabUrl = (): [
  string,
  (url: string, options?: { close?: boolean; navigate?: boolean }) => string
] => {
  const navigate = useNavigate();
  let { pathname } = useLocation();

  let { urlInfoSegment } = useUrlInfo();

  let tabUrl = trimTrailingSlash(pathname).replace(urlInfoSegment, "");
  tabUrl = tabUrl === "" ? "/~1" : tabUrl;

  const navigateTab = React.useCallback(
    (
      segment: string,
      {
        close = false,
        navigate: navigateOption = true,
      }: { close?: boolean; navigate?: boolean } = {}
    ) => {
      const url = `${urlInfoSegment}${tabUrl}`;

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
