import * as React from "react";
import {
  BuilderSelectionProvider,
  ExtendPath,
  useBuilderSelection,
} from "./contexts";
import { dispatchers, listeners } from "./events";
import RenderComponent from "./RenderComponent";
import { RenderContext } from "../src/RenderContext";
import { useCMSElement } from "./useCMSElement";
import { getSiblings } from "./focus";
import { Path, ValueArray } from "@storyflow/frontend/types";

const LOG = false;
export const log: typeof console.log = LOG
  ? (...args) => console.log("$$", ...args)
  : (...args) => {};

export const stringifyPath = (path: Path) => {
  let string = "";
  path.forEach(({ id, parentProp }) => {
    string += `${parentProp ? `/${parentProp.name}` : ""}.${id}`;
  });
  return string.slice(1);
};

const createState = () => {
  let state = {
    id: null as string | null,
    map: new Map<string, ValueArray | Record<string, ValueArray>>(),
  };

  const update = (
    map: Map<string, ValueArray | Record<string, ValueArray>>,
    updates: Record<string, ValueArray | Record<string, ValueArray>>
  ) => {
    const batch = new Set<() => void>();

    const set = (key: string, value: any) => {
      map.set(key, value);
      subscribers.get(key)?.forEach((listener) => batch.add(listener));
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (key.indexOf("/") < 0) {
        // root
        set(key, value);
      } else {
        // prop
        set(key, value);

        const parentKey = key.split(".").slice(0, -1).join(".");
        const [elementId, propKey] = key.split(".").slice(-1)[0].split("/");
        const props = map.get(`${parentKey}.${elementId}`) ?? {};

        set(`${parentKey}.${elementId}`, {
          ...props,
          [propKey]: value,
        });
      }
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
      state.id = id;
      rootSubscriber?.();
    });

    listeners.update.subscribe((updates) => {
      log("RECIEVED UPDATES", updates);
      const batch = update(state.map, updates);
      batch.forEach((listener) => listener());
    });
  }

  const subscribers = new Map<string, Set<() => void>>();
  let rootSubscriber: (() => void) | null = null;

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
    () => Map<string, ValueArray | Record<string, ValueArray>>,
    () => Map<string, ValueArray | Record<string, ValueArray>>
  ] => {
    return [
      (listener) => {
        rootSubscriber = listener;
        return () => {
          rootSubscriber = null;
        };
      },
      () => state.map,
      () => state.map,
    ];
  };

  const sync = (
    key: string
  ): [
    (listener: () => void) => () => void,
    () => ValueArray | Record<string, ValueArray>,
    () => ValueArray | Record<string, ValueArray>
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

  return { syncRoot, sync };
};

const { syncRoot, sync } = createState();

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

const objectKey = useObjectKey();

export function RenderBuilder() {
  const root = useFullValue();

  const id = React.useMemo(
    () => Array.from(root.keys()).find((el) => el.split(".").length === 1),
    [root]
  );

  log("ROOT", root, id);

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
      <BuilderSelectionProvider key={objectKey(root)}>
        <RenderContext.Provider value={useCMSElement}>
          <Frame>
            {id && (
              <ExtendPath extend={id}>
                <RenderComponent parentProp={null} />
              </ExtendPath>
            )}
          </Frame>
        </RenderContext.Provider>
      </BuilderSelectionProvider>
    </>
  );
}

const Frame = ({ children }: { children: React.ReactNode }) => {
  const [, , deselect] = useBuilderSelection();

  return (
    <div
      onClick={(ev) => {
        deselect([]);
      }}
    >
      <div
        onClick={(ev) => {
          ev.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
};

/*
function RenderPreviewEffect() {
  const [ref, setRef] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => setRef(document.body), []);

  return ref ? ReactDOM.createPortal(<Preview />, ref) : null;
}
*/
