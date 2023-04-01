import { Component, Library } from "@storyflow/frontend/types";

export const getDefaultComponent = (type: string, libraries: Library[]) => {
  // we use this only to get the default render components
  // Text, H1, H2, ...
  let component: Component<any> | undefined;
  for (let i = 0; i < libraries.length; i++) {
    component = libraries[i].components[type] as Component<any> | undefined;
    if (component) break;
  }
  return component!;
};
