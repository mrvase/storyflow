import * as React from "react";
import { usePath, useSelectedPath } from "./contexts";
import { dispatchers } from "./events";

const getPathIds = (path: string[]): [parent: string, element: string] => {
  const ids = path;
  return [ids[ids.length - 2] ?? "root", ids[ids.length - 1]];
};

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    style={{
      width: "14px",
      height: "14px",
      color: "rgba(0, 0, 0, 0.8)",
    }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m7.5-7.5h-15"
    />
  </svg>
);

const btnStyle = {
  display: "block",
  position: "absolute",
  width: "18px",
  height: "18px",
  padding: "2px",
  backgroundColor: "rgb(253 224 71)",
} as {};

export const EventHandler = ({ path }: { path: string[] }) => {
  const [parent = "root", element] = getPathIds(path);

  const [isSelected, setIsSelected] = React.useState(false);

  const [inset, setInset] = React.useState<boolean>(true);

  const measureHeight = React.useCallback((node: HTMLElement | null) => {
    if (node) {
      const { height, width } = node.getBoundingClientRect();
      setInset(height > 50 && width > 50);
    }
  }, []);

  const [subscribe, select] = useSelectedPath();
  React.useEffect(() => {
    return subscribe((currentPath) => {
      console.log("$$ PATH", currentPath, path);
      if (currentPath.join("") === path.join("")) {
        setIsSelected(true);
      } else if (isSelected) {
        setIsSelected(false);
      }
    });
  }, [isSelected]);

  const events = useDragEvents(path);

  return (
    <span
      ref={measureHeight}
      onDragStart={isSelected ? events.onDragStart : undefined}
      onDragEnd={isSelected ? events.onDragEnd : undefined}
      draggable={isSelected ? "true" : "false"}
      style={{
        position: "absolute",
        zIndex: 1,
        left: "0px",
        right: "0px",
        top: "0px",
        bottom: "0px",
        outlineWidth: "1px",
        outlineOffset: "-1px",
        ...(isSelected && {
          outlineStyle: "solid",
          outlineColor: "rgb(253 224 71)",
        }),
      }}
      onFocus={(ev) => {
        ev.stopPropagation();
        select(path);
      }}
      tabIndex={0}
      onMouseDown={(ev) => ev.stopPropagation()}
      onClick={(ev) => ev.preventDefault() /* avoid linking */}
      data-cms-event-control="true"
      data-clickable-element="true"
      data-element={element}
      data-parent={parent}
    >
      <span
        data-indicator={element}
        style={{
          position: "absolute",
          top: "calc(50% - 10px)",
          left: "calc(50% - 10px)",
          width: "20px",
          height: "20px",
          borderRadius: "10px",
          backgroundColor: "rgb(253 224 71)",
          opacity: 0,
          transition: "opacity 75ms ease-out",
          pointerEvents: "none",
        }}
      />
      {isSelected && (
        <>
          <span
            style={{
              ...btnStyle,
              ...(inset
                ? { top: 0, left: 0, borderRadius: "0px 0px 2px 0px" }
                : { top: -16, left: -16, borderRadius: "2px 2px 0px 2px" }),
            }}
            onMouseDown={(ev) => ev.preventDefault()}
          >
            <PlusIcon />
          </span>
          <span
            style={{
              ...btnStyle,
              ...(inset
                ? { bottom: 0, right: 0, borderRadius: "2px 0px 0px 0px" }
                : { bottom: -16, right: -16, borderRadius: "0px 2px 2px 2px" }),
            }}
            onMouseDown={(ev) => ev.preventDefault()}
          >
            <PlusIcon />
          </span>
        </>
      )}
    </span>
  );
};

const useDragEvents = (path: string[]) => {
  const [parent, element] = getPathIds(path);

  const [isDragging, setIsDragging] = React.useState(false);

  const rects = React.useRef<{ id: string; rect: DOMRect }[]>([]);
  const next = React.useRef<number | null>(null);

  React.useEffect(() => {
    // const currentIndex = rects.current.findIndex((el) => el.id === element);
    const corners = rects.current.map((el, i) => {
      return {
        id: el.id,
        x: el.rect.left + el.rect.width / 2,
        y: el.rect.top + el.rect.height / 2,
      };
    });
    const getDistance = (
      a: { x: number; y: number },
      b: { x: number; y: number }
    ) => {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    };
    if (isDragging) {
      let prev = next.current;
      const handleMove = (ev: DragEvent) => {
        ev.preventDefault();
        const cursor = { x: ev.clientX, y: ev.clientY };
        const distances = corners.map((el) => getDistance(el, cursor));
        const minimum = Math.min(...distances);
        const index = distances.findIndex((el) => el === minimum);
        if (prev !== index) {
          if (prev !== null) {
            const prevId = rects.current[prev].id;
            const el = document.querySelector(
              `[data-indicator="${prevId}"]`
            ) as HTMLElement;
            el.style.opacity = "0";
          }
          const id = rects.current[index].id;
          if (id !== element) {
            const el = document.querySelector(
              `[data-indicator="${id}"]`
            ) as HTMLElement;
            el.style.opacity = "1";
          }
        }
        prev = next.current;
        next.current = index;
      };

      window.addEventListener("dragover", handleMove);
      return () => {
        window.removeEventListener("dragover", handleMove);
      };
    }
  }, [isDragging]);

  const onDragStart = (ev: React.DragEvent) => {
    ev.stopPropagation();
    const els = Array.from(
      document.querySelectorAll(`[data-parent="${parent}"]`)
    );
    rects.current = (els as HTMLElement[]).map((el) => {
      return { id: el.dataset.element!, rect: el.getBoundingClientRect() };
    });
    setIsDragging(true);
  };

  const onDragEnd = (ev: React.DragEvent) => {
    ev.stopPropagation();
    const currentIndex = rects.current.findIndex((el) => el.id === element);
    if (next.current !== null && currentIndex !== next.current) {
      const el = document.querySelector(
        `[data-indicator="${rects.current[next.current].id}"]`
      ) as HTMLElement;
      el.style.opacity = "0";
      dispatchers.moveComponent.dispatch({
        parent: parent === "root" ? "" : parent,
        from: currentIndex,
        to: next.current,
      });
    }
    setIsDragging(false);
    rects.current = [];
    next.current = null;
  };

  return { onDragStart, onDragEnd };
};

export const useCMSElement = (
  props: React.ComponentProps<"div">
): React.ComponentProps<"div"> => {
  const path = usePath();

  let children: any = (
    <>
      <EventHandler path={path} />
      {props.children}
    </>
  );

  if (typeof props.children === "function") {
    children = (...args: any[]) => (
      <>
        <EventHandler path={path} />
        {(props.children as any)(...args)}
      </>
    );
  }

  return {
    ...props,
    tabIndex: -1,
    style: {
      position: "relative" as "relative",
      pointerEvents: "none" as "none",
      outline: "none",
      ...props.style,
    },
    children,
  };
};
