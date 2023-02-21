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
import ReactDOM from "react-dom";
import { getLibraryConfigs } from "../config";
import { useCSS } from "./useCSS";

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

  const get = (key: string) => state.map.get(key);

  return { get, syncRoot, sync };
};

const { get: getState, syncRoot, sync } = createState();

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
  useCSS();

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
      <SelectPortal />
    </>
  );
}

const Frame = ({ children }: { children: React.ReactNode }) => {
  const [, , deselect] = useBuilderSelection();

  React.useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const target = ev.target;
      if (
        target instanceof HTMLElement &&
        target.dataset["cmsEventControl"] === "true"
      ) {
        return;
      }
      deselect([]);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);

  return <>{children}</>;
};

function SelectPortal() {
  const [ref, setRef] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => setRef(document.body), []);

  return ref ? ReactDOM.createPortal(<Select />, ref) : null;
}

function Select() {
  const configs = getLibraryConfigs();

  const initialOptions = configs
    .map((config) =>
      Object.values(config.components).map((component) => ({
        ...component,
        libraryName: config.name,
        libraryLabel: config.label,
      }))
    )
    .flat(1);

  const [dialog, setDialog_] = React.useState<"select" | "delete" | null>(null);
  const [options, setOptions] = React.useState<typeof initialOptions>([]);
  const [selected, setSelected] = React.useState(0);

  const selectedOption = selected % (dialog === "delete" ? 2 : options.length);

  const activeElement = React.useRef<HTMLElement | null>(null);

  const closeDialog = () => {
    setDialog_(null);
    activeElement.current?.focus();
    activeElement.current = null;
    setSelected(0);
  };

  const setDialog: typeof setDialog_ = (value) => {
    if (value === null) {
      closeDialog();
    } else {
      setDialog_(value);
      const el = document.activeElement as HTMLElement | null;
      if (el?.dataset?.element) {
        activeElement.current = el;
      }
    }
  };

  const getOptionsFromParentPath = (parent: string): typeof initialOptions => {
    const parentOfParent = parent.split(".").slice(0, -1).join(".");
    const parentSegment = parent.split(".").slice(-1)[0];
    const [parentId, parentProp] = parentSegment.split("/");

    if (parentOfParent === "") {
      return initialOptions.filter((el) => !el.hidden);
    } else {
      const parentState = getState(parentOfParent);
      if (!Array.isArray(parentState)) return [];
      const type = parentState.find(
        (el): el is { id: string; type: string; props: any } =>
          typeof el === "object" && "id" in el && el.id === parentId
      )?.type;
      if (!type) return [];
      const config = initialOptions.find(
        (el) => `${el.libraryName}:${el.name}` === type
      );
      if (!config) return [];
      const prop = config.props.find((el) => el.name === parentProp);
      if (!prop) return [];
      if ("options" in prop && prop.options) {
        return initialOptions.filter(
          (el) =>
            el.libraryName === config.libraryName &&
            (prop.options as any[]).includes(`${el.libraryName}:${el.name}`)
        );
      } else {
        return initialOptions.filter((el) => !el.hidden);
      }
    }
  };

  React.useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter") {
        if (dialog === null) {
          const el = document.activeElement as HTMLElement;
          if (!el) return;
          const [parent, element] = [el.dataset.parent, el.dataset.element];
          if (!parent) return;

          const options = getOptionsFromParentPath(parent);

          setOptions(options);
          setDialog((ps) => (ps === null ? "select" : ps));
        } else if (dialog === "delete") {
          if (selectedOption === 0) {
            handleDelete();
          } else {
            closeDialog();
          }
        } else if (dialog === "select") {
          const option = options[selectedOption];
          console.log("OPTION", option);
          handleSelect(option.libraryName, option.name);
        }
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeDialog();
      }
      if (ev.key === "Backspace") {
        setDialog((ps) => (ps === null ? "delete" : ps));
      }
      if (ev.key === "ArrowUp") {
        setSelected((ps) => (ps > 0 ? ps - 1 : ps));
      }
      if (ev.key === "ArrowDown") {
        setSelected((ps) => ps + 1);
      }
    };
    const onBlur = () => {
      closeDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [dialog, selectedOption, options, dispatchers]);

  const handleSelect = (library: string, name: string) => {
    dispatchers.changeComponent.dispatch({ library, name });
    closeDialog();
  };

  const handleDelete = () => {
    dispatchers.deleteComponent.dispatch();
    closeDialog();
  };

  return (
    <>
      <Dialog isOpen={dialog === "select"} close={closeDialog}>
        <div
          style={{
            color: "white",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div
            style={{
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              borderRadius: "6px",
              cursor: "default",
              fontSize: "0.875rem",
              backgroundColor: "#0003",
            }}
            onClick={(ev) => {
              ev.stopPropagation();
              // onSelect(key);
            }}
          >
            <FocusEffect when={dialog === "select"}>
              <input
                type="text"
                style={{
                  height: "2.5rem",
                  width: "100%",
                  background: "none",
                  padding: "0.75rem",
                  outline: "none",
                  fontWeight: "300",
                }}
              />
            </FocusEffect>
          </div>
          {options.map((config, i) => (
            <div
              className={["cms-option", selectedOption === i && "selected"]
                .filter(Boolean)
                .join(" ")}
              key={`${config.libraryName}:${config.name}`}
              onClick={(ev) => {
                ev.stopPropagation();
                handleSelect(config.libraryName, config.name);
              }}
            >
              {config.label ?? config.name}
            </div>
          ))}
        </div>
      </Dialog>
      <Dialog isOpen={dialog === "delete"} close={closeDialog}>
        <div
          style={{
            color: "white",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div
            className={[
              "cms-option",
              "cms-delete",
              selectedOption === 0 && "selected",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={(ev) => {
              ev.stopPropagation();
              handleDelete();
            }}
          >
            Slet element
          </div>
          <div
            className={["cms-option", selectedOption === 1 && "selected"]
              .filter(Boolean)
              .join(" ")}
            onClick={(ev) => {
              ev.stopPropagation();
              closeDialog();
            }}
          >
            Annuller
          </div>
        </div>
      </Dialog>
    </>
  );
}

function FocusEffect({
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

function Dialog({
  children,
  isOpen,
  close,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  close: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: "0rem",
        left: "0rem",
        right: "0rem",
        bottom: "0rem",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        padding: "1rem",
        pointerEvents: isOpen ? "all" : "none",
      }}
      onClick={close}
    >
      <div
        style={{
          background: "rgb(31 41 55)",
          width: "100%",
          maxWidth: "360px",
          borderRadius: "1rem",
          margin: "0 auto",
          transition: "transform 300ms ease-out, opacity 300ms ease-out",
          overflowY: "auto",
          ...(isOpen
            ? {
                opacity: 1,
                transform: `scale(1)`,
                pointerEvents: "all",
              }
            : {
                opacity: 0,
                transform: `scale(0.95)`,
                pointerEvents: "none",
              }),
        }}
      >
        {children}
      </div>
    </div>
  );
}
