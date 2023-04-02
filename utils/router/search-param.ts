import React from "react";
import { useLocation, useNavigator } from "./Router";
import { Path, NavigateOptions } from "./types";
import { createKey } from "./utils";

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
        (options.replace ? navigator.replace : navigator.push)({
          ...path,
          key: createKey(),
          state: options.state ?? null,
        });
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
