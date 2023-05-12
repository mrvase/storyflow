import { ChartBarIcon } from "@heroicons/react/24/outline";
import {
  CMSElement,
  Config,
  PropConfigRecord,
  Props,
  Stories,
} from "@storyflow/react";
import Link from "next/link";

export const HeaderPopoverItem = ({
  href,
  label,
  description,
}: Props<typeof props>) => {
  return (
    <CMSElement>
      <Link
        href={href || "/"}
        className="-m-3 flex items-start rounded-lg p-3 hover:bg-gray-50"
      >
        <ChartBarIcon
          className="h-6 w-6 flex-shrink-0 text-indigo-600"
          aria-hidden="true"
        />
        <div className="ml-4">
          <p className="text-base font-medium text-gray-900">{label}</p>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </Link>
    </CMSElement>
  );
};

const label = "Popoverpunkt";

const props = {
  href: {
    type: "string",
    label: "URL",
  },
  label: {
    type: "string",
    label: "Label",
  },
  description: {
    type: "string",
    label: "Beskrivelse",
  },
} satisfies PropConfigRecord;

const stories = {
  "": {
    props: {
      label: "Hejsa",
      description: "Her er en beskrivelse",
    },
  },
} satisfies Stories<typeof props>;

export const HeaderPopoverItemConfig = {
  label,
  props,
  stories,
  component: HeaderPopoverItem,
} satisfies Config<typeof props>;
