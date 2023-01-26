import { ComponentConfig } from "@storyflow/react/config";

export const NavType = {
  name: "sf/nav",
  label: "Menu",
  props: [
    {
      type: "children",
      name: "children",
      label: "Komponenter",
    },
  ],
} as const satisfies ComponentConfig;
