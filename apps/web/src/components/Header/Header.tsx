import React from "react";
import { cms } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";
import Link from "next/link";
import { PopoverGroup } from "./(PopoverGroup)";
import { HeaderButton } from "./HeaderButton";
import { HeaderItem } from "./HeaderItem";
import { HeaderPopoverConfig } from "./HeaderPopover/config";
import { HeaderPopoverComponent } from "./HeaderPopover";

const HeaderPopover = createComponent(
  HeaderPopoverComponent,
  HeaderPopoverConfig
);

export const Header = createComponent(
  ({ items, buttons }) => {
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
  },
  {
    label: "Sidehoved",
    props: [
      {
        name: "items",
        label: "Menupunkter",
        type: "children",
        options: {
          HeaderPopover,
          HeaderItem,
        },
      },
      {
        name: "buttons",
        label: "Knapper",
        type: "children",
        options: { HeaderItem, HeaderButton },
      },
    ] as const,
    stories: [
      {
        props: {
          items: [HeaderPopover, HeaderItem, HeaderItem, HeaderPopover],
          buttons: [HeaderItem, HeaderButton],
        },
      },
    ],
  }
);
