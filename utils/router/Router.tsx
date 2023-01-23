import React from "react";
import { createHistory } from "./history";
import { Action, History, Location, Navigator } from "./types";
import { parsePath } from "./utils";

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

  let [{ location: locationProp, action }, setState] = React.useState({
    action: navigator.action,
    location: navigator.location,
  });

  React.useLayoutEffect(() => navigator.listen(setState), [history]);

  if (typeof locationProp === "string") {
    locationProp = parsePath(locationProp) as Location;
  }

  const {
    pathname = "/",
    search = "",
    hash = "",
    state = null,
    key = "default",
  } = locationProp;

  const location = React.useMemo(() => {
    let trailingPathname = pathname;

    if (trailingPathname === null) {
      return null;
    }

    return {
      pathname: trailingPathname,
      search,
      hash,
      state,
      key,
    };
  }, [pathname, search, hash, state, key]);

  if (location === null) {
    return null;
  }

  const locationContext = React.useMemo(
    () => ({ location: location!, action }),
    [location, action]
  );

  return (
    <NavigationContext.Provider value={navigator}>
      <LocationContext.Provider value={locationContext}>
        {children}
      </LocationContext.Provider>
    </NavigationContext.Provider>
  );
}
