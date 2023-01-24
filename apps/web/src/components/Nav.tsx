import { cms, CMSElement } from "@storyflow/react";
import Link from "next/link";

export const Nav = {
  component: ({ children }: any) => {
    return (
      <cms.nav className="px-20 py-8 bg-gray-100 flex gap-3">
        {children}
      </cms.nav>
    );
  },
  props: [
    {
      type: "children",
      name: "children",
      label: "Komponenter",
    },
  ],
  label: "Menu",
};

export const NavItem = {
  component: ({ label, href }: any) => {
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
  },
  props: [
    {
      type: "string",
      name: "label",
      label: "Label",
    },
    {
      type: "url",
      name: "href",
      label: "URL",
    },
  ],
  label: "Menulink",
};
