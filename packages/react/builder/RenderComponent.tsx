import { ExtendPath, usePath } from "./contexts";
import { dispatchers } from "./events";
import RenderElement from "./RenderElement";
import { useValue } from "../builder/RenderBuilder";
import { PropConfig, ValueArray } from "@storyflow/frontend/types";

const toRenderable = (
  element: ValueArray[number]
): {
  id: string;
  type: string;
  parent?: string;
  derivedProps?: Record<string, ValueArray>;
} | null => {
  if (typeof element === "object" && "type" in element) {
    return element;
  }
  if (typeof element === "string") {
    return {
      id: Math.random().toString(36).slice(2, 10),
      type: "Text",
      derivedProps: {
        text: [element],
      },
    };
  }
  return null;
};

export default function RenderComponent({
  parentProp,
}: {
  parentProp: PropConfig | null;
}) {
  const path = usePath();

  const value = useValue(path) as ValueArray;

  return (
    <>
      {value.map((element: any) => {
        const render = toRenderable(element);
        if (!render) return null;
        return (
          <ExtendPath
            key={render.id}
            extend={render.parent ? `${render.parent}.${render.id}` : render.id}
            reset={Boolean(render.parent)}
          >
            <RenderElement
              type={render.type}
              props={render.derivedProps}
              parentProp={parentProp}
            />
          </ExtendPath>
        );
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
