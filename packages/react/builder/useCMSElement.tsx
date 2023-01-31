import * as React from "react";
import { useBuilderSelection, usePath } from "./contexts";
import { stringifyPath } from "./RenderBuilder";

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

  const blocker = (
    <span
      style={{
        position: "absolute",
        zIndex: 1,
        left: "0px",
        right: "0px",
        top: "0px",
        bottom: "0px",
        pointerEvents: "auto",
        outlineWidth: "2px",
        borderRadius: "2px",
        // outlineOffset: "2px",
        ...(isSelected && {
          outlineStyle: "solid",
          outlineColor: "rgb(253 224 71)",
        }),
      }}
      onClick={(ev) => ev.preventDefault() /* avoid linking */}
    />
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
    ["data-parent"]: path.split(".").slice(0, -1).join("."),
    ["data-element"]: path.split(".").slice(-1)[0],
    tabIndex: 0,
    children,
  };
};
