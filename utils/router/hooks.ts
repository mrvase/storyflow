import React from "react";
import { useLocation, useNavigator } from "./Router";
import { To, Path, NavigateOptions } from "./types";
import { resolveTo } from "./utils";

export interface NavigateFunction {
  (to: To, options?: NavigateOptions): void;
  (delta: number): void;
}

export function useNavigate(): NavigateFunction {
  let navigator = useNavigator();
  let { pathname } = useLocation();

  let activeRef = React.useRef(false);
  React.useEffect(() => {
    activeRef.current = true;
  });

  let navigate: NavigateFunction = React.useCallback(
    (to: To | number, options: NavigateOptions = {}) => {
      if (!activeRef.current) return;

      if (typeof to === "number") {
        navigator.go(to);
        return;
      }

      let path = resolveTo(to, pathname);

      (!!options.replace ? navigator.replace : navigator.push)(
        path,
        options.state,
        options
      );
    },
    [navigator, pathname]
  );

  return navigate;
}

type ParamSetter = (
  value: string | undefined | ((ps: string | undefined) => string | undefined),
  options?: NavigateOptions & { navigate?: boolean; path?: Path }
) => Path;

export function useSearchParam(key: string) {
  let navigator = useNavigator();
  const oldPath = useLocation();

  const params = new URLSearchParams(oldPath.search ?? "");

  const state = params.get(key) ?? undefined;

  const setState: ParamSetter = React.useCallback(
    (_value, optionsArg = {}) => {
      const { navigate = true, path: pathOption, ...options } = optionsArg;
      const path = { ...(pathOption ?? oldPath) };
      const params = new URLSearchParams(path.search ?? "");

      const state = params.get(key) ?? undefined;
      const nextState = typeof _value === "function" ? _value(state) : _value;

      if (typeof nextState === "undefined") {
        params.delete(key);
      } else {
        params.set(key, nextState);
      }

      path.search = params.toString();

      if (navigate) {
        (options.replace ? navigator.replace : navigator.push)(
          path,
          options.state,
          options
        );
      }

      return path;
    },
    [oldPath]
  );

  return [state, setState] as [
    value: string | undefined,
    setState: ParamSetter
  ];
}

export function useHref(to: To): string {
  let navigator = useNavigator();
  let { hash, pathname, search } = useResolvedPath(to);

  let joinedPathname = pathname;

  return navigator.createHref({ pathname: joinedPathname, search, hash });
}

export function useResolvedPath(to: To): Path {
  let { pathname } = useLocation();
  return React.useMemo(() => resolveTo(to, pathname), [to, pathname]);
}
