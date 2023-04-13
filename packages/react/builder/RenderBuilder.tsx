import * as React from "react";
import { dispatchers, listeners } from "./events";
import { RenderContext } from "../src/RenderContext";
import { useCMSElement } from "./useCMSElement";
import { getSiblings } from "./focus";
import { Path, ValueArray } from "@storyflow/frontend/types";
import ReactDOM from "react-dom";
import { useCSS } from "./useCSS";
import RenderChildren from "./RenderChildren";
import { SelectedPathProvider, useSelectedPath } from "./contexts";
import { Select } from "./Select";

const LOG = true;
export const log: typeof console.log = LOG
  ? (...args) => console.log("$$", ...args)
  : (...args) => {};

const generateKey = () => Math.random().toString(36).slice(2);

const createState = () => {
  let state = {
    root: {
      id: null as string | null,
      key: generateKey(),
    },
    map: new Map<string, ValueArray>(),
    update: 0,
  };

  const update = (
    map: Map<string, ValueArray>,
    updates: Record<string, ValueArray>
  ) => {
    const batch = new Set<() => void>();

    const set = (key: string, value: any) => {
      map.set(key, value);
      subscribers.get(key)?.forEach((listener) => batch.add(listener));
    };

    Object.entries(updates).forEach(([key, value]) => {
      set(key, value);
    });

    log("NEW MAP", map);

    return batch;
  };

  if (typeof window !== "undefined") {
    listeners.initialize.subscribe(({ record, id }) => {
      log("RECIEVED TREE", id, record);
      const newMap = new Map<string, any>();
      update(newMap, record);
      state.map = newMap;
      state.root = {
        key: generateKey(),
        id,
      };
      state.update++;
      rootSubscriber?.();
      updateSubscriber?.();
    });

    listeners.update.subscribe((updates) => {
      log("RECIEVED UPDATES", updates);
      const batch = update(state.map, updates);
      state.update++;
      batch.forEach((listener) => listener());
      updateSubscriber?.();
    });
  }

  const subscribers = new Map<string, Set<() => void>>();
  let rootSubscriber: (() => void) | null = null;
  let updateSubscriber: (() => void) | null = null;

  const addSubscriber = (key: string, subscriber: () => void) => {
    let set = subscribers.get(key);
    if (!set) {
      set = new Set();
      subscribers.set(key, set);
    }
    set.add(subscriber);
  };

  const removeSubscriber = (key: string, subscriber: () => void) => {
    subscribers.get(key)?.delete(subscriber);
  };

  const syncRoot = (): [
    (listener: () => void) => () => void,
    () => { id: string | null; key: string },
    () => { id: string | null; key: string }
  ] => {
    return [
      (listener) => {
        rootSubscriber = listener;
        return () => {
          rootSubscriber = null;
        };
      },
      () => state.root,
      () => state.root,
    ];
  };

  const syncUpdate = (): [
    (listener: () => void) => () => void,
    () => number,
    () => number
  ] => {
    return [
      (listener) => {
        updateSubscriber = listener;
        return () => {
          updateSubscriber = null;
        };
      },
      () => state.update,
      () => state.update,
    ];
  };

  const sync = (
    key: string
  ): [
    (listener: () => void) => () => void,
    () => ValueArray,
    () => ValueArray
  ] => {
    return [
      (listener) => {
        addSubscriber(key, listener);
        return () => {
          removeSubscriber(key, listener);
        };
      },
      () => state.map.get(key)!,
      () => state.map.get(key)!,
    ];
  };

  const get = (key: string) => state.map.get(key);

  return { get, syncUpdate, syncRoot, sync };
};

const state = createState();

const { syncRoot, syncUpdate, sync } = state;
export const { get: getState } = state;

export function useFullValue() {
  const args = React.useMemo(() => syncRoot(), []);
  const value = React.useSyncExternalStore(...args);
  return value;
}

export function useValue(key: string) {
  const args = React.useMemo(() => sync(key), []);
  const value = React.useSyncExternalStore(...args);
  return value;
}

const createKey = () => {
  return Math.random().toString(36).slice(2, 10);
};

export const useObjectKey = () => {
  const ids = new WeakMap();

  return function objectKey(object: object) {
    let key = ids.get(object);
    if (!key) {
      key = createKey();
      ids.set(object, key);
    }
    return key;
  };
};

export function RenderBuilder() {
  useCSS();

  const { id, key } = useFullValue();

  log("ROOT", id, key);

  React.useEffect(() => {
    // unrender makes sure that initial state is passed again on HMR.
    // timeout makes sure that the unrender and render events are not
    // registered in the same render cycle in the CMS
    setTimeout(() => dispatchers.rendered.dispatch(), 5);
    return () => dispatchers.unrendered.dispatch();
  }, []);

  React.useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      const hotkeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (hotkeys.includes(ev.key)) {
        const siblings = getSiblings(activeEl);
        if (siblings.length > 0) {
          ev.preventDefault();
          const index = siblings.findIndex((el) => el === activeEl);
          if (["ArrowUp", "ArrowLeft"].includes(ev.key)) {
            if (index === 0) return;
            siblings[index - 1].focus();
          }
          if (["ArrowRight", "ArrowDown"].includes(ev.key)) {
            if (index === siblings.length - 1) return;
            siblings[index + 1].focus();
          }
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      <SelectedPathProvider key={key}>
        <RenderContext.Provider value={useCMSElement}>
          <Frame>{id && <RenderRoot id={id} />}</Frame>
        </RenderContext.Provider>
      </SelectedPathProvider>
      <BodyPortal>
        <Select />
        <ReadFrameHeight />
      </BodyPortal>
    </>
  );
}

function ReadFrameHeight() {
  const previousHeight = React.useRef(0);

  /*
  const args = React.useMemo(() => syncUpdate(), []);
  const updater = React.useSyncExternalStore(...args);

  React.useEffect(() => {
    const currentHeight = document.body.scrollHeight;
    if (currentHeight !== previousHeight.current) {
      previousHeight.current = currentHeight;
      dispatchers.updateFrameHeight.dispatch(currentHeight);
    }
  }, [updater]);
  */

  React.useEffect(() => {
    dispatchers.updateFrameHeight.dispatch(document.body.scrollHeight);
    const observer = new ResizeObserver((entries) => {
      const currentHeight = document.body.scrollHeight;
      if (currentHeight !== previousHeight.current) {
        previousHeight.current = currentHeight;
        dispatchers.updateFrameHeight.dispatch(currentHeight);
      }
    });
    observer.observe(document.body);
    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}

const RenderRoot = ({ id }: { id: string }) => {
  const value = useValue(id);
  log("VALUE", id, value);
  return <RenderChildren value={value} />;
};

const Frame = ({ children }: { children: React.ReactNode }) => {
  const [, select] = useSelectedPath();

  React.useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const target = ev.target;
      const hasCMSParent = Boolean(
        target instanceof Element &&
          target.closest('[data-clickable-element="true"]')
      );
      if (hasCMSParent) {
        return;
      }
      select([]);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);

  return <>{children}</>;
};

function BodyPortal({ children }: { children: React.ReactNode }) {
  const [ref, setRef] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => setRef(document.body), []);
  return ref ? ReactDOM.createPortal(children, ref) : null;
}

export function FocusEffect({
  children,
  when,
}: {
  children: React.ReactElement;
  when: boolean;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (when) {
      ref.current?.focus();
    } else {
      ref.current?.blur();
    }
  }, [when]);

  return React.cloneElement(children, { ref });
}
