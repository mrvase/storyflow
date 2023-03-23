import * as React from "react";
import { AddPathSegment, ExtendPath, usePath } from "./contexts";
import RenderElement, { IndexContext } from "./RenderElement";
import { log, useValue } from "./RenderBuilder";
import { Component, ValueArray } from "@storyflow/frontend/types";
import { createRenderArray } from "@storyflow/frontend/render";
// import { createRenderArray } from "../config/createRenderArray";
import { ParseRichText } from "../src/ParseRichText";
import { getLibraries, getLibraryConfigs } from "../config";
import { getConfigByType } from "../config/getConfigByType";

const getDefaultComponent = (type: string) => {
  // we use this only to get the default render components
  // Text, H1, H2, ...
  const libraries = getLibraries();
  let component: Component<any> | undefined;
  for (let i = 0; i < libraries.length; i++) {
    component = libraries[i].components[type] as Component<any> | undefined;
    if (component) break;
  }
  return component!;
};

export default function RenderChildren({
  value,
  parentProp = null,
}: {
  value: ValueArray;
  parentProp?: string | null;
}) {
  const index = React.useContext(IndexContext);

  log("RENDER CHILDREN VALUE", value);

  const renderArray = React.useMemo(() => {
    const valueAtIndex = value[index];
    const value_ =
      Array.isArray(valueAtIndex) && valueAtIndex.length === 1
        ? valueAtIndex
        : value;
    const configs = getLibraryConfigs();
    if (!value) return [];
    return createRenderArray(value_, (type: string) =>
      Boolean(getConfigByType(type, configs)?.inline)
    );
  }, [value, index]);

  const createElement = ({ id, element }: { id: string; element: string }) => {
    return (
      <ExtendPath key={id} extend={id}>
        <AddPathSegment
          {...{
            id,
            element,
            parentProp,
          }}
        >
          <RenderElement type={element} />
        </AddPathSegment>
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
              const Component = getDefaultComponent(type)!;
              const string = String(block.$heading[1]);
              /*
              /*
              <ExtendPath
                key={`${index}-${childIndex}`}
                extend={`[${index}]`}
              >
                <AddPathSegment
                  {...{
                    id: `[${index}]`,
                    type,
                    parentProp,
                  }}
                >
                </AddPathSegment>
              </ExtendPath>
              */
              return (
                <Component key={`${index}-${childIndex}`}>
                  <ParseRichText>{string}</ParseRichText>
                </Component>
              );
            }
            if ("$text" in block) {
              const type = "Text";
              const Component = getDefaultComponent(type)!;
              /*
              <ExtendPath
                key={`${index}-${childIndex}`}
                extend={`[${index}]`}
              >
                <AddPathSegment
                  {...{
                    id: `[${index}]`,
                    type,
                    parentProp,
                  }}
                >
                </AddPathSegment>
              </ExtendPath>
              */
              return (
                <Component key={`${index}-${childIndex}`}>
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
        cursor: "default",
      }}
    >
      <div
        style={{
          padding: "0.25rem 0.25rem",
          borderRadius: "999px",
          backgroundColor: "rgb(224 230 235)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "0.75rem",
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
