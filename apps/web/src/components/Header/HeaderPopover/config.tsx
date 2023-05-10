import { HeaderPopover } from ".";
import { HeaderPopoverCTAConfig } from "../HeaderPopoverCTA";
import { HeaderPopoverItemConfig } from "../HeaderPopoverItem";
import { Config, Props } from "@storyflow/react";

export const HeaderPopoverConfig = {
  label: "Menulistepunkt",
  hidden: true,
  props: {
    label: {
      label: "Label",
      type: "string",
    },
    items: {
      label: "Punkter",
      type: "children",
      options: {
        HeaderPopoverItemConfig,
      },
    },
    callsToAction: {
      label: "Call To Action-knapper",
      type: "children",
      options: {
        HeaderPopoverCTAConfig,
      },
    },
  },
  stories: {
    "": {
      props: {
        label: "Løsninger",
        items: [HeaderPopoverItemConfig],
        callsToAction: [HeaderPopoverCTAConfig],
      },
    },
  },
  component: HeaderPopover,
} satisfies Config;

export type HeaderPopoverProps = Props<(typeof HeaderPopoverConfig)["props"]>;
