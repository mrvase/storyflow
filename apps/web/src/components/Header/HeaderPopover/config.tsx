import { PartialConfig } from "@storyflow/react/config";
import { HeaderPopoverCTA } from "../HeaderPopoverCTA";
import { HeaderPopoverItem } from "../HeaderPopoverItem";

export const HeaderPopoverConfig = {
  label: "Menulistepunkt",
  hidden: true,
  props: [
    {
      name: "label",
      label: "Label",
      type: "string",
    },
    {
      name: "items",
      label: "Punkter",
      type: "children",
      options: {
        HeaderPopoverItem,
      },
    },
    {
      name: "callsToAction",
      label: "Call To Action-knapper",
      type: "children",
      options: {
        HeaderPopoverCTA,
      },
    },
  ] as const,
  stories: [
    {
      props: {
        label: "Løsninger",
        items: [HeaderPopoverItem as any],
        callsToAction: [HeaderPopoverCTA as any],
      },
    },
  ],
} satisfies PartialConfig;
