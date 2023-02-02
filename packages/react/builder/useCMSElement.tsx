import * as React from "react";
import { useBuilderSelection, usePath } from "./contexts";
import { dispatchers } from "./events";
import { stringifyPath } from "./RenderBuilder";

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    style={{
      width: "16px",
      height: "16px",
      color: "white",
    }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m7.5-7.5h-15"
    />
  </svg>
);

export const useCMSElement = (
  props: React.ComponentProps<"div">
): React.ComponentProps<"div"> & {
  "data-parent": string;
  "data-element": string;
} => {
  const path = usePath();
  const [subscribe, select] = useBuilderSelection();
  const [isSelected, setIsSelected] = React.useState(false);

  React.useEffect(() => {
    return subscribe((currentPath) => {
      console.log(
        "CURRENT PATH",
        currentPath,
        stringifyPath(currentPath),
        path
      );
      if (stringifyPath(currentPath) === path.split(".").slice(1).join(".")) {
        setIsSelected(true);
      } else if (isSelected) {
        setIsSelected(false);
      }
    });
  }, [isSelected]);

  const btnStyle = {
    display: "block",
    position: "absolute",
    width: "22px",
    height: "22px",
    borderRadius: "10px",
    backgroundColor: "rgb(253 224 71)",
  } as {};

  const parent = path.split(".").slice(0, -1).join(".");
  const element = path.split(".").slice(-1)[0];

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
    console.log("DRAG END");
    const currentIndex = rects.current.findIndex((el) => el.id === element);
    if (next.current !== null && currentIndex !== next.current) {
      const el = document.querySelector(
        `[data-indicator="${rects.current[next.current].id}"]`
      ) as HTMLElement;
      el.style.opacity = "0";
      dispatchers.moveComponent.dispatch({
        parent,
        from: currentIndex,
        to: next.current,
      });
    }
    setIsDragging(false);
    rects.current = [];
    next.current = null;
  };

  const blocker = (
    <span
      onDragStart={isSelected ? onDragStart : undefined}
      onDragEnd={isSelected ? onDragEnd : undefined}
      draggable={isSelected ? "true" : "false"}
      style={{
        position: "absolute",
        zIndex: 1,
        left: "0px",
        right: "0px",
        top: "0px",
        bottom: "0px",
        pointerEvents: "auto",
        outlineWidth: "2px",
        borderRadius: "1px",
        outlineOffset: "-2px",
        ...(isSelected && {
          outlineStyle: "solid",
          outlineColor: "rgb(253 224 71)",
        }),
      }}
      onClick={(ev) => ev.preventDefault() /* avoid linking */}
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
        }}
      />
      {/*isSelected && (
        <>
          <span
            style={{
              ...btnStyle,
              top: 2,
              left: 2,
              borderRadius: "0px 0px 20px 0px",
            }}
          >
            <PlusIcon />
          </span>
          <span
            style={{
              ...btnStyle,
              bottom: 2,
              right: 2,
              borderRadius: "20px 0px 0px 0px",
              padding: "6px 0px 0px 6px",
            }}
          >
            <PlusIcon />
          </span>
        </>
          )*/}
    </span>
  );

  let children: any = (
    <>
      {blocker}
      {props.children}
    </>
  );

  if (typeof props.children === "function") {
    children = (...args: any[]) => (
      <>
        {blocker}
        {(props.children as any)(...args)}
      </>
    );
  }

  return {
    ...props,
    style: {
      position: "relative" as "relative",
      pointerEvents: "none" as "none",
      outline: "none",
      // opacity: isDragging ? 0.5 : undefined,
      ...props.style,
    },
    onFocus: (ev: React.FocusEvent<HTMLDivElement, Element>) => {
      ev.stopPropagation();
      select([]);
      props.onFocus?.(ev);
    },
    /*
    onBlur: (ev: React.FocusEvent<HTMLDivElement, Element>) => {
      ev.stopPropagation();
      // deselect(path);
      props.onBlur?.(ev);
    },
    */
    ["data-parent"]: parent,
    ["data-element"]: element,
    tabIndex: 0,
    children,
  };
};
