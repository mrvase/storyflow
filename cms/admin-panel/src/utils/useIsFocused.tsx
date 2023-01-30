import React from "react";
import { createStaticStore } from "../state/StaticStore";

const IsFocusedContext = React.createContext<ReturnType<
  typeof createStaticStore<Record<string, boolean>>
> | null>(null);

export function FocusOrchestrator({ children }: { children: React.ReactNode }) {
  const store = React.useMemo(
    () => createStaticStore<Record<string, boolean>>(new Map([["", {}]])),
    []
  );

  return (
    <IsFocusedContext.Provider value={store}>
      {children}
    </IsFocusedContext.Provider>
  );
}

export function useFocusedIds() {
  const ctx = React.useContext(IsFocusedContext);
  if (!ctx) return [];
  const obj = ctx.useKey("")[0];
  return React.useMemo(
    () =>
      Object.entries(obj ?? {})
        .filter((el) => el[1])
        .map((el) => el[0]),
    [obj]
  );
}

export default function useIsFocused({
  id,
  multiple,
  holdShiftKey,
}: { multiple?: boolean; id?: string; holdShiftKey?: boolean } = {}) {
  const ctx = React.useContext(IsFocusedContext);

  const [uniqueId] = React.useState(() =>
    Math.random().toString(36).slice(2, 10)
  );

  let [isFocused, setIsFocused] = [false, () => {}] as [
    boolean,
    (value: boolean) => void
  ];

  if (id && ctx) {
    const [isFocused_, setIsFocused_] = ctx.useKey(
      "",
      (record) => record?.[id]
    );
    isFocused = isFocused_ ?? false;
    setIsFocused = (value: boolean) => {
      setIsFocused_((oldRecord) => {
        let record = { ...(oldRecord ?? {}) };
        record[id] = value;
        return record;
      });
    };
  } else {
    [isFocused, setIsFocused] = React.useState(false);
  }

  React.useEffect(() => {
    return () => {
      setIsFocused(false);
    };
  }, []);

  const isInsideClick = React.useRef(false);

  React.useEffect(() => {
    const handleBlur = () => {
      const el = document.activeElement;
      if (
        el &&
        el.tagName === "IFRAME" &&
        el.getAttribute("data-select") === uniqueId
      ) {
        setIsFocused(true);
      } else {
        setIsFocused(false);
      }
    };

    if (isFocused) {
      const handleMouseDown = (ev: MouseEvent) => {
        if (multiple && ev.shiftKey) {
          return;
        }

        const { clientX, clientY } = ev;

        let noDeselect = false;
        let noSelect = false;

        document.elementsFromPoint(clientX, clientY)?.forEach((element) => {
          if (element.getAttribute("data-focus-ignore")) {
            noSelect = true;
          }
          if (element.getAttribute("data-focus-remain")) {
            noDeselect = true;
          }
        });

        if (noSelect) return;

        if (!isInsideClick.current) {
          if (noDeselect) return;
          setIsFocused(false);
        } else {
          isInsideClick.current = false;
        }
      };

      document.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("blur", handleBlur);
      return () => {
        document.removeEventListener("mousedown", handleMouseDown);
        window.addEventListener("blur", handleBlur);
      };
    }

    window.addEventListener("blur", handleBlur);
    return () => {
      window.addEventListener("blur", handleBlur);
    };
  }, [isFocused]);

  const handlers = {
    onMouseDown: (ev: React.MouseEvent<HTMLElement>) => {
      if (holdShiftKey && ev.shiftKey) {
        ev.preventDefault();
        const el = document.querySelector(
          `[data-selectable="${uniqueId}"]`
        ) as HTMLElement | null;
        if (el) {
          el.focus();
          window.getSelection()?.collapse(el, 0);
        }
      }

      if (holdShiftKey === true && !ev.shiftKey) {
        return;
      }

      if (isFocused && holdShiftKey) {
        setIsFocused(false);
        return;
      }

      if (isFocused) {
        isInsideClick.current = true;
        return;
      }

      setTimeout(() => {
        setIsFocused(true);
      });
    },
    "data-selectable": uniqueId,
  };

  return { isFocused, handlers, id: uniqueId };
}
