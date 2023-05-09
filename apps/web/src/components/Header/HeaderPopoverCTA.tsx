import { PlayIcon } from "@heroicons/react/24/outline";
import {
  Config,
  PropConfigRecord,
  Props,
  Stories,
  cms,
} from "@storyflow/react";
import Link from "next/link";

export const HeaderPopoverCTA = ({ label, href }: Props<typeof props>) => {
  return (
    <cms.div className="flow-root">
      <Link
        href={href || "/"}
        className="-m-3 flex items-center rounded-md p-3 text-base font-medium text-gray-900 hover:bg-gray-100"
      >
        <PlayIcon
          className="h-6 w-6 flex-shrink-0 text-gray-400"
          aria-hidden="true"
        />
        <span className="ml-3">{label}</span>
      </Link>
    </cms.div>
  );
};

const label = "Call to Action";

const props = {
  href: {
    type: "string",
    label: "URL",
  },
  label: {
    type: "string",
    label: "Label",
  },
} satisfies PropConfigRecord;

const stories = {
  "": {
    props: {
      href: "",
      label: "Se video",
    },
  },
} satisfies Stories<typeof props>;

export const HeaderPopoverCTAConfig = {
  label,
  hidden: true,
  props,
  stories,
  component: HeaderPopoverCTA,
} satisfies Config<typeof props>;
