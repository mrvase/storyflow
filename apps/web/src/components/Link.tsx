import { CMSElement } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";
import NextLink from "next/link";

export const Link = createComponent(
  ({ href, label }) => {
    return (
      <CMSElement>
        <NextLink href={href || "/"} className="text-blue-500">
          {label}
        </NextLink>
      </CMSElement>
    );
  },
  {
    label: "Link",
    props: [
      {
        type: "string",
        name: "label",
        label: "Label",
        searchable: true,
      },
      {
        type: "string",
        name: "href",
        label: "URL",
      },
    ],
    inline: true,
  }
);
