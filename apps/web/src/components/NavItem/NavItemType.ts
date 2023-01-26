import { ComponentConfig } from "@storyflow/react/config";

export const NavItemType = {
  name: "sf/nav-item",
  label: "Menulink",
  props: [
    {
      type: "string",
      name: "label",
      label: "Label",
    },
    {
      type: "string",
      name: "href",
      label: "URL",
    },
  ],
} as const satisfies ComponentConfig;
