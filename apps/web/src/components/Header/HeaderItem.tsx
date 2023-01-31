import { cms, CMSElement } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";
import Link from "next/link";

export const HeaderItem = createComponent(
  ({ label, href }) => {
    return (
      <CMSElement>
        <Link
          href={`/${href ?? ""}`}
          className="whitespace-nowrap text-base font-medium text-gray-500 hover:text-gray-900"
        >
          {label}
        </Link>
      </CMSElement>
    );
  },
  {
    label: "Menupunkt",
    hidden: true,
    props: [
      { name: "label", label: "Label", type: "string" },
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
          label: "Et link",
        },
      },
    ],
  }
);
