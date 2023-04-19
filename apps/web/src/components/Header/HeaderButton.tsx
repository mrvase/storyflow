import { CMSElement } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";
import Link from "next/link";

export const HeaderButton = createComponent(
  ({ label, href }) => {
    return (
      <CMSElement>
        <Link
          href={href || "/"}
          className="ml-8 inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          {label || "Ingen label"}
        </Link>
      </CMSElement>
    );
  },
  {
    label: "Knap",
    hidden: true,
    props: [
      {
        type: "string",
        name: "label",
        label: "Label",
      },
      {
        name: "href",
        label: "URL",
        type: "string",
      },
    ] as const,
    stories: [
      {
        props: {
          href: "",
          label: "Log ind",
        },
      },
    ],
  }
);
