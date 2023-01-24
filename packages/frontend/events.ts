import { Path, SharedComponentRecord } from "./types";

/**
 * TODO temporarily using ordinary events.
 * should then receive window as parent/iframe, not document.
 */

export const createEventsFromIframeToCMS = () => {
  let state = {
    target: null as Window | null,
    id: null as string | null,
  };

  return {
    setTarget: (id: string, win: Window | null = null) => {
      state.id = id;
      state.target = win;
    },
    rendered: createIframeEvent<SharedComponentRecord>("rendered", state),
    unrendered: createIframeEvent("unrendered", state),
    selection: createIframeEvent<Path>("selection", state),
    createComponent: createIframeEvent<{
      path: string;
      type: string;
    }>("create-component", state),
    changeComponent: createIframeEvent<string>("change-component", state),
  };
};

export const createEventsFromCMSToIframe = () => {
  let state = {
    target: null as Window | null,
    id: null as string | null,
  };

  return {
    setTarget: (id: string, win: Window | null = null) => {
      state.id = id;
      state.target = win;
    },
    select: createIframeEvent("select", state),
    initialize: createIframeEvent<{ record: Record<string, any>; id: string }>(
      "initialize",
      state
    ),
    update: createIframeEvent<Record<string, any>>("update", state),
  };
};

const token = "nm43puc5guext0yte2i8wzg5";

const SOURCE = "storyflow-cms";

export function createIframeEvent<T = undefined>(
  _name: string,
  options: { target: Window | null; id: string | null }
) {
  const name = `__CMS__${_name}`;

  /*
  if (controlSet.has(name)) {
    throw new Error(`Custom event already exists with name: ${_name}`);
  } else {
    controlSet.add(name);
  }
  */

  return {
    dispatch: (...args: T extends undefined ? [] : [T]) => {
      if (!options.target) {
        return;
      }
      const message = {
        token,
        id: options.id,
        event: name,
        payload: args[0],
        source: SOURCE,
      };
      options.target.postMessage(
        message,
        "*" // listener ? "http://localhost:4000" : "http://localhost:4001"
      );
    },
    subscribe: (callback: (payload: T) => void) => {
      const func = (
        ev: Event & {
          data?: {
            id: string;
            token: string;
            event: string;
            payload: T;
            source: string;
          };
        }
      ) => {
        const data = ev.data!;
        if (
          !data ||
          typeof data !== "object" ||
          !("id" in data) ||
          !("source" in data) ||
          !("event" in data) ||
          !("payload" in data)
        ) {
          return;
        }
        if (
          data.id !== options.id ||
          data.source !== SOURCE ||
          data.token !== token ||
          data.event !== name
        ) {
          return;
        }
        callback(data.payload);
      };
      window.addEventListener("message", func);
      return () => {
        window.removeEventListener("message", func);
      };
    },
  };
}
