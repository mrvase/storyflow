import * as React from "react";
import { ExtendPath, useConfig, usePath, useSelectedPath } from "./contexts";
import RenderElement from "./RenderElement";
import type { ConfigRecord, ValueArray } from "@storyflow/shared/types";
import { createRenderArray } from "@storyflow/client/render";
import { ParseRichText } from "../src/ParseRichText";
import { getConfigByType } from "../config/getConfigByType";
import { EditorProvider } from "./editor";
import { getDefaultComponent } from "../utils/getDefaultComponent";

export default function RenderChildren({
  value,
  options,
}: {
  value: ValueArray;
  options?: ConfigRecord;
}) {
  const { configs, libraries } = useConfig();

  const renderArray = React.useMemo(() => {
    /*
    let array: ValueArray = [];
    if (spread) {
      const valueAtIndex = value[index];
      array = Array.isArray(valueAtIndex) ? valueAtIndex : [valueAtIndex];
    } else if (value.length === 1 && Array.isArray(value[0])) {
      array = value[0];
    } else {
      array = value;
    }
    if (!value) return [];
    */
    return createRenderArray(value, (type: string) =>
      Boolean(getConfigByType(type, { configs })?.config?.inline)
    );
  }, [value]);

  const createElement = ({ id, element }: { id: string; element: string }) => {
    return (
      <ExtendPath key={id} id={id}>
        <RenderElement type={element} options={options} />
      </ExtendPath>
    );
  };

  return (
    <>
      {renderArray.reduce((acc, block, index) => {
        const renderChildren = "$children" in block ? block.$children : [block];

        acc.push(
          ...renderChildren.map((block, childIndex) => {
            if ("$heading" in block) {
              const type = `H${block.$heading[0]}`;
              const Component = getDefaultComponent(type, libraries)!;
              const string = String(block.$heading[1]);
              return (
                <ExtendPath key={`${index}-${childIndex}`} id={`[${index}]`}>
                  <Component>
                    <ParseRichText>{string}</ParseRichText>
                  </Component>
                </ExtendPath>
              );
            }
            if ("$text" in block) {
              const type = "Text";
              const Component = getDefaultComponent(type, libraries)!;
              return (
                <ExtendPath key={`${index}-${childIndex}`} id={`[${index}]`}>
                  <EditorProvider string={block.$text.join("")}>
                    <Component>
                      {block.$text.map((el, textElementIndex) => {
                        if (typeof el === "object") {
                          return createElement(el);
                        }
                        return (
                          <ParseRichText
                            key={`${index}-${childIndex}-${textElementIndex}`}
                          >
                            {String(el)}
                          </ParseRichText>
                        );
                      })}
                    </Component>
                  </EditorProvider>
                </ExtendPath>
              );
            }
            return createElement(block);
          })
        );

        return acc;
      }, [] as React.ReactNode[])}
      {value && value.length === 0 && <AddComponent />}
    </>
  );
}

const AddComponent = () => {
  const path = usePath();
  const [isSelected, setIsSelected] = React.useState(false);
  const [subscribe, select] = useSelectedPath();
  React.useEffect(() => {
    return subscribe((currentPath) => {
      if (currentPath.join("") === path.join("")) {
        setIsSelected(true);
      } else if (isSelected) {
        setIsSelected(false);
      }
    });
  }, [isSelected]);

  return (
    <div
      data-clickable-element="true"
      onClick={() => {
        /*
            dispatchers.createComponent.dispatch({
              path,
              name: "",
              library: "",
            })
            */
      }}
      style={{
        position: "relative",
        zIndex: 2, // above click tracker
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "sans-serif",
        pointerEvents: "auto",
        outlineWidth: "1px",
        outlineOffset: "-1px",
        ...(isSelected && {
          outlineStyle: "solid",
          outlineColor: "rgb(253 224 71)",
        }),
        border: "1px solid #ddd",
        backgroundColor: "#f8f8f8",
        borderRadius: "4px",
        cursor: "pointer",
      }}
      onFocus={(ev) => {
        ev.stopPropagation();
        select(path);
      }}
      tabIndex={0}
    >
      <div
        style={{
          padding: "0.25rem 0.25rem",
          borderRadius: "999px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "0.75rem",
          color: "#bbb",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          style={{
            width: "1rem",
            height: "1rem",
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
      </div>
    </div>
  );
};
