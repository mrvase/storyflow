import {
  Config,
  PropConfigRecord,
  Props,
  Stories,
  cms,
} from "@storyflow/react";
import Link from "next/link";

export const HeaderButton = ({ label, href }: Props<typeof props>) => {
  return (
    <cms.div>
      <Link
        href={href || "/"}
        className="ml-8 inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        {label || "Ingen label"}
      </Link>
    </cms.div>
  );
};

const label = "Knap";

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
      label: "Log ind",
    },
  },
} satisfies Stories<typeof props>;

export const HeaderButtonConfig = {
  label,
  props,
  stories,
  component: HeaderButton,
} satisfies Config<typeof props>;
