import { CMSElement } from "@storyflow/react";
import { Component } from "@storyflow/react/config";
import Link from "next/link";
import { NavItemType } from "./NavItemType";

export const NavItem = (({ label, href }) => {
  return (
    <CMSElement>
      <Link
        href={href ? `/${href}` : "/"}
        className="px-3 py-2 rounded text-sm bg-gray-300"
      >
        {label}
      </Link>
    </CMSElement>
  );
}) satisfies Component<typeof NavItemType>;
