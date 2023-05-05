import React from "react";

let isInserted = false;

const css = `
body {
  overflow: hidden;
}

*:not([contenteditable="true"]) {
  pointer-events: none !important;
}

*[contenteditable="true"] {
  pointer-events: auto !important;
  z-index: 2;
}

*[contenteditable="true"]::before {
  content: "";
  position: absolute;
  pointer-events: none !important;
  z-index: 1;
  left: 0px;
  right: 0px;
  top: 0px;
  bottom: 0px;
  outline-width: 1px;
  outline-offset: -1px;
  outline-style: solid;
  outline-color: rgb(253 224 71);
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.05);
}

[data-clickable-element="true"],
[data-clickable-element="true"] * {
  pointer-events: auto !important;
}

.cms-option {
  height: 2.5rem;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  border-radius: 6px;
  cursor: default;
  font-size: 0.875rem;
  font-weight: 300;
}

.cms-option:hover {
  background-color: #fff1;
}

.cms-delete {
  background-color: #d334;
}

.cms-delete:hover {
  background-color: #d337;
}

.cms-option.selected {
  box-shadow: inset 0 0 0 calc(1px + 0px) rgb(55 65 81);
}
`;

export function useCSS() {
  React.useInsertionEffect(() => {
    if (!isInserted) {
      isInserted = true;
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    }
  });
}
