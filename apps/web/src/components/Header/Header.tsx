import React from "react";
import {
  Config,
  PropConfigRecord,
  Props,
  Stories,
  cms,
} from "@storyflow/react";
import Link from "next/link";
import { PopoverGroup } from "./(PopoverGroup)";
import { HeaderButtonConfig } from "./HeaderButton";
import { HeaderItemConfig } from "./HeaderItem";
import { HeaderPopoverConfig } from "./HeaderPopover/config";
import { child } from "@storyflow/react";

export const Header = ({ items, buttons }: Props<typeof props>) => {
  return (
    <cms.div className="mx-auto max-w-7xl px-6">
      <div className="flex items-center justify-between border-b-2 border-gray-100 py-6 md:justify-start md:space-x-10">
        <div className="flex justify-start lg:w-0 lg:flex-1">
          <Link href="/">
            <span className="sr-only">Your Company</span>
            <img
              className="h-8 w-auto sm:h-10"
              src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
              alt=""
            />
          </Link>
        </div>
        <PopoverGroup>{items}</PopoverGroup>
        <div className="hidden items-center justify-end md:flex md:flex-1 lg:w-0">
          {buttons}
        </div>
      </div>
    </cms.div>
  );
};

const props = {
  items: {
    type: "children",
    label: "Menupunkter",
    options: {
      HeaderItemConfig,
      HeaderPopoverConfig,
    },
  },
  buttons: {
    type: "children",
    label: "Knapper",
    options: {
      HeaderItemConfig,
      HeaderButtonConfig,
    },
  },
} satisfies PropConfigRecord;

const stories = {
  "": {
    props: {
      items: [
        child(HeaderPopoverConfig),
        child(HeaderItemConfig),
        child(HeaderItemConfig, {
          props: {
            label: "Produkter",
          },
        }),
        child(HeaderItemConfig),
      ],
      buttons: [child(HeaderItemConfig), child(HeaderButtonConfig)],
    },
  },
} satisfies Stories<typeof props>;

export const HeaderConfig = {
  label: "Sidehoved",
  props: props,
  stories,
  component: Header,
} satisfies Config<typeof props>;
