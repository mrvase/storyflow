import * as React from "react";
import { ExtendPath, usePath } from "./contexts";
import RenderElement from "./RenderElement";
import { useValue } from "../builder/RenderBuilder";
import { Component, PropConfig, ValueArray } from "@storyflow/frontend/types";
import { createRenderArray } from "./createRenderArray";
import { ParseRichText } from "../src/ParseRichText";
import { getLibraries, getLibraryConfigs } from "../config";

const getComponentByType = (type: string) => {
  // we use this only to get the default render components
  // Text, H1, H2, ...
  // If we used getConfigByType, we would lack the ComponentConfig and not find the Component
  const libraries = getLibraries();
  const filtered = libraries.filter((el) => el.name === "")!;
  let component: Component<any> | undefined;
  for (let i = 0; i < filtered.length; i++) {
    component = filtered[i].components[type] as Component<any> | undefined;
    if (component) break;
  }
  return component!;
};

export default function RenderComponent({
  parentProp,
}: {
  parentProp: PropConfig | null;
}) {
  const path = usePath();

  const value = useValue(path) as ValueArray;

  const renderArray = React.useMemo(
    () => createRenderArray(value, getLibraryConfigs()),
    [value]
  );

  const createElement = (element: {
    id: string;
    type: string;
    parent?: string;
  }) => {
    return (
      <ExtendPath
        key={element.id}
        extend={element.parent ? `${element.parent}.${element.id}` : element.id}
        reset={Boolean(element.parent)}
      >
        <RenderElement type={element.type} parentProp={parentProp} />
      </ExtendPath>
    );
  };

  return (
    <>
      {renderArray.map((block, i1) => {
        if ("$heading" in block) {
          const Component = getComponentByType(`H${block.$heading[0]}`)!;
          const string = String(block.$heading[1]);
          return (
            <Component key={i1}>
              <ParseRichText>{string}</ParseRichText>
            </Component>
          );
        }
        if ("$text" in block) {
          const Component = getComponentByType("Text")!;
          return (
            <Component key={i1}>
              {block.$text.map((el, i2) => {
                if (typeof el === "object") {
                  return createElement(el);
                }
                return (
                  <ParseRichText key={`${i1}-${i2}`}>
                    {String(el)}
                  </ParseRichText>
                );
              })}
            </Component>
          );
        }
        return createElement(block);
      })}
      {value.length === 0 && (
        <div
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
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "0.75rem",
            backgroundColor: "rgb(249 250 251)",
            border: "1px dashed rgb(156 163 175)",
            fontFamily: "sans-serif",
            borderRadius: "4px",
            pointerEvents: "auto",
            cursor: "default",
          }}
        >
          <div
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "999px",
              backgroundColor: "rgb(224 230 235)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "0.75rem",
              letterSpacing: "0.025rem",
              color: "rgb(107 114 128)",
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
                marginRight: "0.25rem",
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            TILFØJ
          </div>
        </div>
      )}
    </>
  );
}
