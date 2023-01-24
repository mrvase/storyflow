import React from "react";

const IsFocusedContext = React.createContext<{
  register: (id: any) => void;
  getElements: () => any[];
} | null>(null);

export function FocusOrchestrator({ children }: { children: React.ReactNode }) {
  const elements = React.useRef(new Set<{ item: any }>());

  const ctx = React.useMemo(
    () => ({
      register: (item: any) => {
        const obj = { item };
        elements.current.add(obj);
        return () => {
          elements.current.delete(obj);
        };
      },
      getElements: () => Array.from(elements.current, (x) => x.item),
    }),
    []
  );

  return (
    <IsFocusedContext.Provider value={ctx}>
      {children}
    </IsFocusedContext.Provider>
  );
}

export function useFocusedElements() {
  const ctx = React.useContext(IsFocusedContext);
  if (!ctx) return () => [];
  return ctx.getElements;
}

export default function useIsFocused({
  multiple,
  item,
  holdShiftKey,
}: { multiple?: boolean; item?: any; holdShiftKey?: boolean } = {}) {
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  const [id] = React.useState(() => Math.random().toString(36).slice(2, 10));

  const isInsideClick = React.useRef(false);

  const ctx = React.useContext(IsFocusedContext);

  React.useEffect(() => {
    if (ctx && item && isFocused) {
      return ctx.register(item);
    }
  }, [item, isFocused]);

  React.useEffect(() => {
    const handleBlur = () => {
      const el = document.activeElement;
      if (
        el &&
        el.tagName === "IFRAME" &&
        el.getAttribute("data-select") === id
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
          `[data-selectable="${id}"]`
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
    "data-selectable": id,
  };

  return { isFocused, handlers, id };
}
