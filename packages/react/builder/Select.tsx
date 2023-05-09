import * as React from "react";
import { dispatchers } from "./events";
import { FocusEffect, getState } from "./RenderBuilder";
import {
  Config,
  LibraryConfigRecord,
  NestedElement,
} from "@storyflow/shared/types";

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
        transition: "opacity 300ms ease-out",
        backgroundColor: "rgba(0,0,0,0.3)",
        ...(isOpen
          ? {
              opacity: 1,
            }
          : {
              opacity: 0,
            }),
        pointerEvents: isOpen ? "auto" : "none",
      }}
      onClick={close}
      data-clickable-element={isOpen ? "true" : undefined}
    >
      <div
        style={{
          background: "rgb(31 41 55)",
          width: "100%",
          maxWidth: "360px",
          borderRadius: "1rem",
          margin: "0 auto",
          transition: "transform 300ms ease-out",
          overflowY: "auto",
          ...(isOpen
            ? {
                transform: `scale(1)`,
              }
            : {
                transform: `scale(0.95)`,
              }),
        }}
      >
        {children}
      </div>
    </div>
  );
}

const getOptionsFromParentPath = (
  parent: string,
  configs: LibraryConfigRecord
) => {
  const initialOptions = Object.entries(configs)
    .map(([libraryName, config]) =>
      Object.entries(config.configs).map(([name, component]) => ({
        ...component,
        name,
        libraryName,
        libraryLabel: config.label,
      }))
    )
    .flat(1);

  const parentOfParent = parent.split(".").slice(0, -1).join(".");
  const parentSegment = parent.split(".").slice(-1)[0];
  const [parentId, parentProp] = parentSegment.split("/");

  if (parentOfParent === "") {
    return initialOptions.filter((el) => !el.hidden);
  } else {
    const parentState = getState(parentOfParent);
    if (!Array.isArray(parentState)) return [];
    const type = parentState.find(
      (el): el is NestedElement =>
        typeof el === "object" && "id" in el && el.id === parentId
    )?.element;
    if (!type) return [];
    const config = initialOptions.find(
      (el) => `${el.libraryName}:${el.name}` === type
    );
    if (!config) return [];
    const prop = Object.entries(config.props).find(
      ([name]) => name === parentProp
    )?.[1];
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

export function Select({ configs }: { configs: LibraryConfigRecord }) {
  const [dialog, setDialog_] = React.useState<"select" | "delete" | null>(null);
  const [options, setOptions] = React.useState<
    (Config & {
      name: string;
      libraryName: string;
      libraryLabel: string;
    })[]
  >([]);

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

  React.useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter") {
        if (dialog === null) {
          const el = document.activeElement as HTMLElement;
          if (!el) return;
          const [parent, element] = [el.dataset.parent, el.dataset.element];
          if (!parent) return;

          const options = getOptionsFromParentPath(parent, configs);

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
