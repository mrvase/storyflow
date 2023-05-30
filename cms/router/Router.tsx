import React from "react";
import { createHistory } from "./history";
import {
  Action,
  History,
  Location,
  NavigateOptions,
  Navigator,
  To,
} from "./types";
import { createKey, resolveTo } from "./utils";

type NavigationContextObject = Navigator;

export const NavigationContext = React.createContext<NavigationContextObject>(
  null!
);

export function useNavigator(): Navigator {
  return React.useContext(NavigationContext);
}

interface LocationContextObject {
  location: Location;
  action: Action;
}

export const LocationContext = React.createContext<LocationContextObject>(
  null!
);

export function useLocation(): Location {
  return React.useContext(LocationContext).location;
}

export function useAction(): string {
  return React.useContext(LocationContext).action;
}

interface NavigateFunction {
  (to: To | number, options?: NavigateOptions): void;
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

      (!!options.replace ? navigator.replace : navigator.push)({
        ...path,
        key: createKey(),
        state: options.state ?? null,
      });
    },
    // navigator is a stable ref
    [pathname]
  );

  return navigate;
}

export interface BrowserRouterProps {
  children?: React.ReactNode;
  window?: Window;
}

export function Router({ children, window }: BrowserRouterProps) {
  const historyRef = React.useRef<History>();
  if (historyRef.current == null) {
    historyRef.current = createHistory({ window });
  }

  const navigator = historyRef.current;

  let [state, setState] = React.useState({
    action: navigator.action,
    location: navigator.location,
  });

  React.useLayoutEffect(() => navigator.listen(setState), [history]);

  return (
    <NavigationContext.Provider value={navigator}>
      <LocationContext.Provider value={state}>
        {children}
      </LocationContext.Provider>
    </NavigationContext.Provider>
  );
}
