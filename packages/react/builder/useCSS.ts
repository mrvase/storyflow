import React from "react";

let isInserted = false;

const css = `
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
    // As explained earlier, we don't recommend runtime injection of <style> tags.
    // But if you have to do it, then it's important to do in useInsertionEffect.
    if (!isInserted) {
      isInserted = true;
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    }
  });
}
