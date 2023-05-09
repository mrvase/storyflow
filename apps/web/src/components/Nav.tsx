import {
  cms,
  CMSElement,
  Config,
  PropConfigRecord,
  Props,
  withComponent,
} from "@storyflow/react";
import Link from "next/link";

export const NavItemConfig = withComponent(
  function NavItem({ label, href }) {
    return (
      <CMSElement>
        <Link href={href || "/"} className="rounded text-sm font-bold">
          {label || "Ingen label"}
        </Link>
      </CMSElement>
    );
  },

  {
    label: "Menulink",
    props: {
      label: {
        type: "string",
        label: "Label",
        searchable: true,
      },
      href: {
        type: "string",
        label: "URL",
      },
    },
    stories: {
      "": {
        props: {
          label: "Testlabel",
        },
      },
    },
  }
);

export const Nav = ({ children }: Props<typeof props>) => {
  return (
    <cms.nav className="px-20 py-8 flex gap-5 justify-end">{children}</cms.nav>
  );
};

const props = {
  children: {
    type: "children",
    label: "Komponenter",
    options: { NavItemConfig },
  },
} satisfies PropConfigRecord;

export const NavConfig = {
  label: "Menu",
  props,
  stories: {
    test: {
      props: {
        children: [NavItemConfig, NavItemConfig],
      },
    },
  },
  component: Nav,
} satisfies Config<typeof props>;
