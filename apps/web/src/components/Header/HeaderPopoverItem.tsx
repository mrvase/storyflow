import { ChartBarIcon } from "@heroicons/react/24/outline";
import { cms, CMSElement } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";
import Link from "next/link";

export const HeaderPopoverItem = createComponent(
  ({ href, label, description }) => {
    return (
      <CMSElement>
        <Link
          href={`/${href ?? ""}`}
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
  },
  {
    label: "Popoverpunkt",
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
      {
        name: "description",
        label: "Beskrivelse",
        type: "string",
      },
    ],
    stories: [
      {
        props: {
          label: "Hejsa",
          description: "Her er en beskrivelse",
        },
      },
    ],
  }
);
