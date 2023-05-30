import type { Path, To } from "./types";

export function createKey() {
  return Math.random().toString(36).substring(2, 10);
}

export function parsePath(path: string): Partial<Path> {
  let parsedPath: Partial<Path> = {};

  if (path) {
    let hashIndex = path.indexOf("#");
    if (hashIndex >= 0) {
      parsedPath.hash = path.substring(hashIndex);
      path = path.substring(0, hashIndex);
    }

    let searchIndex = path.indexOf("?");
    if (searchIndex >= 0) {
      parsedPath.search = path.substring(searchIndex);
      path = path.substring(0, searchIndex);
    }

    if (path) {
      parsedPath.pathname = path;
    }
  }

  return parsedPath;
}

export function resolveTo(toArg: To, from: string): Path {
  let to = typeof toArg === "string" ? parsePath(toArg) : { ...toArg };
  let isEmptyPath = toArg === "" || to.pathname === "";
  let toPathname = isEmptyPath ? "/" : to.pathname;

  let path = resolvePath(to, from);

  // Ensure the pathname has a trailing slash if the original "to" had one
  let hasExplicitTrailingSlash =
    toPathname && toPathname !== "/" && toPathname.endsWith("/");
  // Or if this was a link to the current path which has a trailing slash
  let hasCurrentTrailingSlash = isEmptyPath && from.endsWith("/");
  if (
    !path.pathname.endsWith("/") &&
    (hasExplicitTrailingSlash || hasCurrentTrailingSlash)
  ) {
    path.pathname += "/";
  }

  return path;
}

function resolvePath(to: To, fromPathname = "/"): Path {
  let {
    pathname: toPathname,
    search = "",
    hash = "",
  } = typeof to === "string" ? parsePath(to) : to;

  let pathname = toPathname
    ? toPathname.startsWith("/")
      ? toPathname
      : resolvePathname(toPathname, fromPathname)
    : fromPathname;

  return {
    pathname,
    search: normalizeSearch(search),
    hash: normalizeHash(hash),
  };
}

function resolvePathname(relativePath: string, fromPathname: string): string {
  let segments = fromPathname.replace(/\/+$/, "").split("/");
  let relativeSegments = relativePath.split("/");

  relativeSegments.forEach((segment) => {
    if (segment === "..") {
      // Keep the root "" segment so the pathname starts at /
      if (segments.length > 1) segments.pop();
    } else if (segment !== ".") {
      segments.push(segment);
    }
  });

  return segments.length > 1 ? segments.join("/") : "/";
}

// export const normalizePathname = (pathname: string): string =>
//   pathname.replace(/\/+$/, "").replace(/^\/*/, "/");

const normalizeSearch = (search: string): string => {
  return !search || search === "?"
    ? ""
    : search.startsWith("?")
    ? search
    : "?" + search;
};

const normalizeHash = (hash: string): string => {
  return !hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash;
};

export function createPath({
  pathname = "/",
  search = "",
  hash = "",
}: Partial<Path>) {
  if (search && search !== "?")
    pathname += search.charAt(0) === "?" ? search : "?" + search;
  if (hash && hash !== "#")
    pathname += hash.charAt(0) === "#" ? hash : "#" + hash;
  return pathname;
}

// export const joinPaths = (paths: string[]): string =>
//   paths.join("/").replace(/\/\/+/g, "/");
