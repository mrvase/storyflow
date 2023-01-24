import React from "react";

export function ParseRichText({ children }: { children: string }) {
  if (!children) return null;
  return (
    <>
      {children
        .split("\n")
        .map((el) => [<br />, el])
        .flat(1)
        .slice(1)
        .map((el, index) => (
          <React.Fragment key={index}>{el}</React.Fragment>
        ))}
    </>
  );
}
