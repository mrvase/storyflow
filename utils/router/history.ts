import { To, Location, Action, Listener, History } from "./types";
import { parsePath, createPath } from "./utils";

const PopStateEventType = "popstate";

export type HistoryOptions = {
  window?: Window;
};

export function createHistory(options: HistoryOptions = {}): History {
  let { window = document.defaultView! } = options;
  let globalHistory = window.history;
  let action: Action = "POP";
  let listener: Listener | null = null;

  function handlePop() {
    action = "POP";
    if (listener) {
      listener({ action, location: history.location });
    }
  }

  function push(to: To, state?: any) {
    action = "PUSH";
    let location = createLocation(history.location, to, state);

    let historyState = getHistoryState(location);
    let url = history.createHref(location);

    // try...catch because iOS limits us to 100 pushState calls :/
    try {
      globalHistory.pushState(historyState, "", url);
    } catch (error) {
      // They are going to lose state here, but there is no real
      // way to warn them about it since the page will refresh...
      window.location.assign(url);
    }

    if (listener) {
      listener({ action, location });
    }
  }

  function replace(to: To, state?: any) {
    action = "REPLACE";
    let location = createLocation(history.location, to, state);

    let historyState = getHistoryState(location);
    let url = history.createHref(location);
    globalHistory.replaceState(historyState, "", url);

    if (listener) {
      listener({ action, location });
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

function getLocation(window: Window, globalHistory: Window["history"]) {
  let { pathname, search, hash } = window.location;
  return createLocation(
    "",
    { pathname, search, hash },
    // state defaults to `null` because `window.history.state` does
    (globalHistory.state && globalHistory.state.usr) || null,
    (globalHistory.state && globalHistory.state.key) || "default"
  );
}

function createKey() {
  return Math.random().toString(36).substr(2, 8);
}

function createLocation(
  current: string | Location,
  to: To,
  state: any = null,
  key?: string
): Readonly<Location> {
  let location: Readonly<Location> = {
    pathname: typeof current === "string" ? current : current.pathname,
    search: "",
    hash: "",
    ...(typeof to === "string" ? parsePath(to) : to),
    state,
    // TODO: This could be cleaned up.  push/replace should probably just take
    // full Locations now and avoid the need to run through this flow at all
    // But that's a pretty big refactor to the current test suite so going to
    // keep as is for the time being and just let any incoming keys take precedence
    key: (to && (to as Location).key) || key || createKey(),
  };
  return location;
}

type HistoryState = {
  usr: any;
  key?: string;
};

function getHistoryState(location: Location): HistoryState {
  return {
    usr: location.state,
    key: location.key,
  };
}
