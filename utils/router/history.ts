import type { Location, Action, Listener, History } from "./types";
import { parsePath, createPath, createKey } from "./utils";

const PopStateEventType = "popstate";

type HistoryOptions = {
  window?: Window;
};

type HistoryState = {
  usr: any;
  key?: string;
};

export function createHistory(options: HistoryOptions = {}): History {
  let { window = document.defaultView! } = options;
  let globalHistory = window.history;
  let action: Action = "POP";
  let listener: Listener | null = null;

  function push(to: string | Location) {
    action = "PUSH";

    let location = createLocation(history.location, to);
    let historyState = getHistoryState(location);
    let url = history.createHref(location);

    // try...catch because iOS limits us to 100 pushState calls
    try {
      globalHistory.pushState(historyState, "", url);
    } catch (error) {
      window.location.assign(url);
    }

    if (listener) {
      listener({ action, location });
    }
  }

  function replace(to: string | Location) {
    action = "REPLACE";

    let location = createLocation(history.location, to);
    let historyState = getHistoryState(location);
    let url = history.createHref(location);

    globalHistory.replaceState(historyState, "", url);

    if (listener) {
      listener({ action, location });
    }
  }

  function handlePop() {
    action = "POP";
    if (listener) {
      listener({ action, location: history.location });
    }
  }

  let history: History = {
    get action() {
      return action;
    },
    get location() {
      return getLocation(window, globalHistory);
    },
    listen(fn: Listener) {
      if (listener) {
        throw new Error("A history only accepts one active listener");
      }
      window.addEventListener(PopStateEventType, handlePop);
      listener = fn;

      return () => {
        window.removeEventListener(PopStateEventType, handlePop);
        listener = null;
      };
    },
    createHref(to) {
      return typeof to === "string" ? to : createPath(to);
    },
    push,
    replace,
    go(n) {
      return globalHistory.go(n);
    },
  };

  return history;
}

function getLocation(
  window: Window,
  globalHistory: Window["history"]
): Readonly<Location> {
  let { pathname, search, hash } = window.location;
  return {
    pathname,
    search,
    hash,
    // state defaults to `null` because `window.history.state` does
    state: (globalHistory.state && globalHistory.state.usr) || null,
    key: (globalHistory.state && globalHistory.state.key) || "default",
  };
}

function createLocation(
  current: string | Location,
  next: string | Location
): Readonly<Location> {
  let location: Readonly<Location> = {
    pathname: typeof current === "string" ? current : current.pathname,
    search: "",
    hash: "",
    key: createKey(),
    state: null,
    ...(typeof next === "string" ? parsePath(next) : next),
  };
  return location;
}

function getHistoryState(location: Location): HistoryState {
  return {
    usr: location.state,
    key: location.key,
  };
}
