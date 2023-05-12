import {
  CMSElement,
  Config,
  PropConfigRecord,
  Props,
  Stories,
} from "@storyflow/react";
import Link from "next/link";

export const HeaderItem = ({ label, href }: Props<typeof props>) => {
  return (
    <CMSElement>
      <Link
        href={href || "/"}
        className="whitespace-nowrap text-base font-medium text-gray-500 hover:text-gray-900"
      >
        {label || "Ingen label"}
      </Link>
    </CMSElement>
  );
};

const props = {
  label: {
    type: "string",
    label: "Label",
  },
  href: {
    type: "string",
    label: "URL",
  },
} satisfies PropConfigRecord;

const stories = {
  "": {
    props: {
      href: "",
      label: "Et link",
    },
  },
  "Tester lige": {
    props: {},
  },
} satisfies Stories<typeof props>;

export const HeaderItemConfig = {
  label: "Menupunkt",
  hidden: true,
  props,
  stories,
  component: HeaderItem,
} satisfies Config<typeof props>;
