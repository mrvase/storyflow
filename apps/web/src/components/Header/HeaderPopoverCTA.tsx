import { PlayIcon } from "@heroicons/react/24/outline";
import { cms } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";
import Link from "next/link";

export const HeaderPopoverCTA = createComponent(
  ({ label, href }) => {
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
  },
  {
    label: "Call to Action",
    hidden: true,
    props: [
      {
        name: "href",
        label: "URL",
        type: "string",
      },
      {
        name: "label",
        label: "Label",
        type: "string",
      },
    ],
    stories: [
      {
        props: {
          href: "",
          label: "Se video",
        },
      },
    ],
  }
);
