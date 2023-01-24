import React from "react";

type RenderHook<T extends keyof JSX.IntrinsicElements> = (
  props: React.ComponentProps<T>
) => React.ComponentProps<T>;

export const RenderContext = React.createContext<RenderHook<any> | null>(null);

export const useRenderContext = () => {
  return React.useContext(RenderContext);
};
