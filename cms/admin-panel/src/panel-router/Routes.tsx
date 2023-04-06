import { useNavigate, useLocation } from "@storyflow/router";
import React from "react";
import { useContextWithError } from "../utils/contextError";
import { usePanelActions } from "./PanelRouter";
import { PanelData, RouteConfig } from "./types";
import { replacePanelPath } from "./utils";

/*
[
  <Current>
    [
      <Current>
          [
            <Current />,
            <Prev>
              [
                <Prev />,
              ]
            </Prev>
          ]
      </Current>,
    ],
  </Current>
]
*/

/*
[
  <Current>
    [
      <Current>
          [
            <Current>
              [
                <Current>
                  [
                    <Current />,
                  ]
                </Current>,
              ]
            </Current>,
            <Prev>
              [
                <Prev>
                  [
                    <Prev />
                  ]
                </Prev>,
              ]
            </Prev>
          ]
      </Current>,
    ],
  </Current>
]
*/

export const PanelContext = React.createContext<PanelData | null>(null);
export const RouteContext = React.createContext<string | null>(null);
export const TransitionContext = React.createContext<string | null>(null);

export function usePanel(data?: PanelData) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const ctx = data ?? useContextWithError(PanelContext, "PanelContext");
  const actions = usePanelActions();

  const index = ctx.index;

  const getHref = React.useCallback(
    (path: string, options: { navigate?: boolean } = {}) => {
      const href = replacePanelPath(pathname, { path, index });
      if (options.navigate) {
        navigate(href);
      }
      return href;
    },
    [pathname, navigate, index]
  );

  const close = React.useCallback(
    () => actions!.close(index),
    [actions, index]
  );

  return React.useMemo(
    () => [ctx, getHref, close] as [typeof ctx, typeof getHref, typeof close],
    [ctx, close]
  );
}

export function useRoute() {
  return useContextWithError(RouteContext, "RouteContext");
}

function usePrevious<T>(value: T) {
  const [prev, setPrev] = React.useState<T>();
  const [current, setCurrent] = React.useState<T>();

  let isReset = false;

  if (current !== value) {
    setPrev(current);
    setCurrent(value);
    isReset = true;
  }
  return [prev || value, isReset] as [T, boolean];
}

export function Routes({
  routes,
  data,
}: {
  routes: RouteConfig[];
  data: PanelData;
}) {
  const path = data.path;
  const [prev, isReset] = usePrevious(path); // is set to current path on mount

  const prevData = React.useMemo(() => {
    return {
      path: prev,
      key: data.key,
      index: data.index,
    };
  }, [prev, data.index]);

  const prevSegments = React.useMemo(
    () => ["", ...prev.split("/").filter(Boolean)],
    [prev]
  );

  const currentSegments = React.useMemo(
    () => ["", ...path.split("/").filter(Boolean)],
    [path]
  );

  const replace = prevSegments.length === currentSegments.length;

  const depth = Math.max(prevSegments.length, currentSegments.length);

  const firstNonMatch = React.useMemo(() => {
    for (let i = 0; i < depth; i++) {
      if (prevSegments[i] !== currentSegments[i]) {
        return i;
      }
    }
    return null;
  }, [prev, path]);

  const children = Array.from({ length: depth }).reduce(
    (children: [current: React.ReactNode, prev?: React.ReactNode], _, i) => {
      const index = depth - 1 - i;
      const currentSegment = currentSegments[index];
      const prevSegment = prevSegments[index];

      const prevMatch =
        prevSegment !== undefined
          ? routes.find((p) => p.matcher.test(prevSegment))
          : null;

      const currentMatch =
        currentSegment !== undefined
          ? routes.find((p) => p.matcher.test(currentSegment))
          : null;

      if (currentMatch === undefined || prevMatch === undefined) {
        throw new Error("Page does not exist: " + currentSegment);
      }

      console.log("MATCH", {
        index,
        currentSegment,
        prevSegment,
        currentMatch,
        prevMatch,
      });

      if (firstNonMatch !== null && index === firstNonMatch - 1) {
        // has both paths as children (merges)
        // (will always exist since first segment is always a match)

        return [
          currentMatch ? (
            <RouteTransition key={currentSegment}>
              <PanelContext.Provider value={data}>
                <RouteContext.Provider
                  value={currentSegments.slice(0, index + 1).join("/")}
                >
                  <currentMatch.component>{children}</currentMatch.component>
                </RouteContext.Provider>
              </PanelContext.Provider>
            </RouteTransition>
          ) : null,
        ] as [React.ReactNode];
      } else if (firstNonMatch !== null && index >= firstNonMatch) {
        // handles two paths
        return [
          prevMatch ? (
            <RouteTransition
              key={prevSegment}
              exit
              replace={firstNonMatch === index && replace}
            >
              <PanelContext.Provider value={prevData}>
                <RouteContext.Provider
                  value={prevSegments.slice(0, index + 1).join("/")}
                >
                  <prevMatch.component>{[children[1]]}</prevMatch.component>
                </RouteContext.Provider>
              </PanelContext.Provider>
            </RouteTransition>
          ) : null,
          currentMatch ? (
            <RouteTransition
              key={currentSegment}
              replace={firstNonMatch === index && replace}
            >
              <PanelContext.Provider value={data}>
                <RouteContext.Provider
                  value={currentSegments.slice(0, index + 1).join("/")}
                >
                  <currentMatch.component>
                    {[children[0]]}
                  </currentMatch.component>
                </RouteContext.Provider>
              </PanelContext.Provider>
            </RouteTransition>
          ) : null,
        ] as [React.ReactNode, React.ReactNode];
      } else {
        return [
          currentMatch ? (
            <RouteTransition key={currentSegment}>
              <PanelContext.Provider value={data}>
                <RouteContext.Provider
                  value={currentSegments.slice(0, index + 1).join("/")}
                >
                  <currentMatch.component>
                    {[children[0]]}
                  </currentMatch.component>
                </RouteContext.Provider>
              </PanelContext.Provider>
            </RouteTransition>
          ) : null,
        ] as [React.ReactNode];
      }
    },
    [null, null] // deepest
  );

  if (isReset) {
    return null;
  }

  return <>{children}</>;
}

export const useRouteTransition = () =>
  useContextWithError(TransitionContext, "TransitionContext");

function RouteTransition({
  children,
  exit,
  replace,
}: {
  children: React.ReactNode;
  exit?: boolean;
  replace?: boolean;
}) {
  const [status, setStatus] = React.useState(
    `unmounted${replace ? "-replace" : ""}`
  );
  const [exited, setExited] = React.useState(false);
  if (!exit && exited) {
    setExited(false);
    setStatus(`unmounted${replace ? "-replace" : ""}`);
  }

  React.useEffect(() => {
    setStatus(
      `${exit ? "exited" : "entered"}${exit && replace ? "-replace" : ""}`
    );
  }, [exit, replace]);

  React.useEffect(() => {
    if (exit) {
      let t = setTimeout(() => {
        setExited(true);
      }, 500);
      return () => {
        clearTimeout(t);
      };
    }
  }, [exit]);

  return !exited ? (
    <TransitionContext.Provider value={status}>
      {children}
    </TransitionContext.Provider>
  ) : null;
}
