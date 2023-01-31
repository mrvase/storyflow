import { cms, CMSElement } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";
import Link from "next/link";

export const NavItem = createComponent(
  ({ label, href }) => {
    return (
      <CMSElement>
        <Link
          href={href ? `/${href}` : "/"}
          className="rounded text-sm font-bold"
        >
          {label}
        </Link>
      </CMSElement>
    );
  },
  {
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
    ] as const,
    stories: [
      {
        props: {
          label: "Testlabel",
        },
      },
    ],
  }
);

export const Nav = createComponent(
  ({ children }) => {
    return (
      <cms.nav className="px-20 py-8 flex gap-5 justify-end">
        {children}
      </cms.nav>
    );
  },
  {
    label: "Menu",
    props: [
      {
        type: "children",
        name: "children",
        label: "Komponenter",
        options: { NavItem },
      },
    ] as const,
    stories: [
      {
        props: {
          children: [NavItem, NavItem],
        },
      },
    ],
  }
);
