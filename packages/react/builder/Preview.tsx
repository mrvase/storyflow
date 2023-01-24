import React from "react";
import { getComponents } from "../src/ComponentRecord";
import { dispatchers } from "./events";

export function Preview() {
  const components = getComponents();

  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "c") {
        setOpen((ps) => !ps);
      }
    };
    const onBlur = () => {
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const onSelect = (type: string) => {
    dispatchers.changeComponent.dispatch(type);
    setOpen(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "0rem",
        left: "0rem",
        right: "0rem",
        bottom: "0rem",
        zIndex: 999,
        overflowY: "auto",
        display: "flex",
        alignItems: "center",
        padding: "1rem",
        ...(open
          ? {
              pointerEvents: "all",
            }
          : {
              pointerEvents: "none",
            }),
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: "rgb(8, 14, 26)",
          width: "100%",
          maxWidth: "724px",
          borderRadius: "1rem",
          margin: "0 auto",
          transition: "transform 300ms ease-out, opacity 300ms ease-out",
          ...(open
            ? {
                opacity: 1,
                transform: `scale(1)`,
                pointerEvents: "all",
              }
            : {
                opacity: 0,
                transform: `scale(0.95)`,
                pointerEvents: "none",
              }),
        }}
      >
        <div
          style={{
            color: "white",
            padding: "1.25rem",
            display: "grid",
            gridAutoFlow: "dense",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "1.25rem",
          }}
        >
          {Object.entries(components).map(([key, config]) => (
            <div
              key={key}
              style={{
                backgroundColor: "#ffffff0e",
                padding: "1.25rem",
                borderRadius: "6px",
                cursor: "default",
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelect(key);
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "bold",
                  opacity: "0.75",
                  marginBottom: "1rem",
                }}
              >
                {config.label ?? key}
              </div>
              <div
                style={{
                  transform: "scale(0.80)",
                  transformOrigin: "top left",
                }}
              >
                <div
                  style={{
                    border: "1px #fff1 solid",
                    width: "125%",
                    pointerEvents: "none",
                  }}
                >
                  <config.component
                    {...Object.fromEntries(
                      config.props.map(({ name, type }) => [
                        name,
                        type === "string" ? "Testtekst" : <></>,
                      ])
                    )}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
