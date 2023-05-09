import type { Component, LibraryRecord } from "@storyflow/shared/types";

export const getDefaultComponent = (type: string, libraries: LibraryRecord) => {
  // we use this only to get the default render components
  // Text, H1, H2, ...
  let component: Component<any> | undefined;
  const values = Object.values(libraries);
  for (let i = 0; i < values.length; i++) {
    component = values[i]?.[type] as Component<any> | undefined;
    if (component) break;
  }
  return component!;
};
