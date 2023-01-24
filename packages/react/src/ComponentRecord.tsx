import Outlet from "./Outlet";
import { SharedComponentConfig } from "./types";

export interface ComponentConfig extends SharedComponentConfig {
  component: React.FC<any>;
}

export type ComponentRecord = {
  [name: string]: ComponentConfig;
};

let components: ComponentRecord | null = null;

export function getComponents() {
  if (components === null) {
    throw new Error(
      "Components have not been added. Make sure to add components before the site renders."
    );
  }
  return components ?? {};
}

export function addComponents(record: ComponentRecord) {
  if (components === null) {
    components = {
      Outlet: {
        component: Outlet,
        props: [],
        label: "Outlet",
      },
    };
  }
  Object.assign(components, record);
}
